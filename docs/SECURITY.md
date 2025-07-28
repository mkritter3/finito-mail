# Security Architecture - Client-First Model

## Overview

This document defines the security architecture for our client-first email client. With emails stored entirely client-side and direct provider API access, we achieve unprecedented privacy - your emails never touch our servers.

## Security Principles

1. **Client-Side Encryption**: All sensitive data encrypted in the browser
2. **Zero Server Storage**: No emails, tokens, or personal data on our servers
3. **Direct Provider Access**: OAuth tokens used directly from browser
4. **Minimal Attack Surface**: No central database to breach
5. **User-Controlled Privacy**: You own your data completely

## Hybrid Backend-for-Frontend Security Model

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                            │
├─────────────────────────────────────────────────────────────┤
│  Session Tokens ─► Supabase Auth (JWT)                    │
│  Email Bodies ──► IndexedDB (encrypted)                   │
│  Attachments ──► IndexedDB (encrypted)                    │
│  Search Index ─► MiniSearch.js (local)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────────────────────────┐
        │                    BACKEND                             │
        ├─────────────────────────────────────────────────────────────┤
        │  OAuth Tokens ─► Gmail/Outlook API proxy            │
        │  Email Headers ─► PostgreSQL (metadata only)       │
        │  Sync State ──► Redis (temporary)                 │
        └─────────────────────────────────────────────────────────────┘
                          ↓
        EMAIL CONTENT NEVER STORED ON SERVER
```

## Authentication - PKCE Flow

### OAuth 2.0 with PKCE (Proof Key for Code Exchange)
```
1. Browser generates code_verifier (cryptographically random)
2. Browser creates code_challenge = SHA256(code_verifier)
3. Browser → Provider: /authorize?code_challenge={hash}
4. User authorizes in provider
5. Provider → Browser: authorization code
6. Browser → Provider: exchange code + code_verifier for tokens
7. Tokens stored encrypted in IndexedDB
8. Server never sees tokens!
```

### Implementation
```typescript
// Client-side PKCE implementation
class PKCEAuth {
  async initiate() {
    // Generate cryptographically secure verifier
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    
    // Create challenge
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const challenge = base64url(new Uint8Array(digest));
    
    // Store verifier locally
    sessionStorage.setItem('pkce_verifier', verifier);
    
    // Redirect to provider
    window.location.href = `${PROVIDER_URL}/authorize?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${REDIRECT_URI}&` +
      `code_challenge=${challenge}&` +
      `code_challenge_method=S256`;
  }
  
  async handleCallback(code: string) {
    const verifier = sessionStorage.getItem('pkce_verifier');
    
    // Exchange code for tokens - direct from browser!
    const response = await fetch(`${PROVIDER_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI
      })
    });
    
    const { access_token, refresh_token } = await response.json();
    
    // Encrypt and store locally
    await this.securelyStoreTokens(access_token, refresh_token);
  }
}
```

## Token Storage - Client-Side Encryption

### WebCrypto API Encryption
```typescript
class SecureTokenStorage {
  private async deriveKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const salt = await this.getSalt(); // Stored in IndexedDB
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  async encryptToken(token: string, password: string): Promise<void> {
    const key = await this.deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(token)
    );
    
    // Store in IndexedDB
    await db.tokens.put({
      id: 'oauth_token',
      data: encrypted,
      iv: iv
    });
  }
}
```

## Email Storage Security

### IndexedDB Encryption
```typescript
class SecureEmailStorage {
  async storeEmail(email: Email): Promise<void> {
    // Optional: encrypt email content
    if (this.encryptionEnabled) {
      email.content = await this.encrypt(email.content);
      email.attachments = await Promise.all(
        email.attachments.map(a => this.encrypt(a))
      );
    }
    
    // Store in IndexedDB (50GB+ available)
    await db.emails.put(email);
  }
  
  private async encrypt(data: string): Promise<string> {
    const key = await this.getUserKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(data)
    );
    
    return JSON.stringify({
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    });
  }
}
```

## Google API Key Security

### Secure Storage Architecture
```typescript
// API key encryption flow
class APIKeyManager {
  async storeGoogleAPIKey(apiKey: string, userPassphrase: string) {
    // Derive encryption key from passphrase
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(userPassphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Encrypt API key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      new TextEncoder().encode(apiKey)
    );
    
    // Store encrypted in IndexedDB
    await db.api_keys.put({
      provider: 'google',
      encryptedKey: new Uint8Array(encrypted),
      salt,
      iv,
      createdAt: new Date()
    });
  }
}
```

### API Key Usage
- **Never sent to server**: All Gemini calls from browser
- **Rate limiting**: Client-side tracking
- **Validation**: Test query before storage
- **Rotation**: Prompt user to update expired keys

## Security Benefits of Hybrid Architecture

### 1. Reduced Honeypot Risk
- Traditional: Millions of emails in central database
- Hybrid: Only metadata on servers, content stays client-side
- Breach impact: Headers compromised, not email content

### 2. Content Privacy Architecture
- Email bodies never stored on servers
- Only headers and metadata for functionality
- Content encryption keys stay client-side

### 3. Backend-for-Frontend Security
- Leverages provider security (Google/Microsoft)
- Server handles auth and coordination securely
- OAuth tokens managed server-side with proper refresh

### 4. Layered Security Model
- Server authentication with Supabase Auth
- Client-side encryption for sensitive content
- Minimal server exposure with maximum functionality

## Backend Security Layer

### Supabase Authentication
```typescript
// Secure JWT-based authentication with refresh tokens
export async function authenticateUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return { error: 'No token provided' };
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { error: 'Invalid token' };
    }
    
    return { user };
  } catch (error) {
    return { error: 'Token verification failed' };
  }
}
```

### Rate Limiting (Upstash Redis)
```typescript
// Prevent API abuse with user-specific limits
export async function checkRateLimit(userId: string) {
  const key = `rate:${userId}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 3600); // 1 hour window
  }
  
  return current <= 1000; // 1000 requests/hour per user
}
```

## Security Considerations

### Browser Storage Limits
- IndexedDB eviction: Implement re-sync strategy
- Clear browsing data: Warn users about data loss
- Incognito mode: Detect and warn about limitations

### Multi-Device Sync
- Device pairing via QR code
- End-to-end encrypted sync channel
- No central server involvement

### Recovery Mechanisms
- Encrypted backup to provider
- Password reset via provider OAuth
- Emergency access via recovery codes

## Compliance & Privacy

### GDPR Compliance
- **Data Minimization**: We store nothing
- **Right to Deletion**: User controls all data
- **Data Portability**: Direct export from browser
- **Privacy by Design**: Architecture prevents data collection

### Security Auditing
- Client-side code is open for inspection
- No black-box server processing
- Security through transparency

## Incident Response

### Client-Side Breach
- Scope limited to single user
- No lateral movement possible
- User can revoke OAuth tokens directly

### Server Breach (Minimal Impact)
- No user emails accessible
- No tokens to steal
- Only rate limit data exposed

## Multi-Window Security

### BroadcastChannel Security
```typescript
// Secure cross-window messaging
class SecureWindowSync {
  private channel: BroadcastChannel;
  private windowId: string;
  
  constructor() {
    this.windowId = crypto.randomUUID();
    this.channel = new BroadcastChannel('email-sync');
    
    // Validate incoming messages
    this.channel.onmessage = (event) => {
      if (!this.validateMessage(event.data)) {
        console.error('Invalid message structure');
        return;
      }
      
      // Process only data changes, not sensitive info
      if (event.data.type === 'email-update') {
        this.handleEmailUpdate(event.data);
      }
    };
  }
  
  private validateMessage(data: any): boolean {
    return data.windowId && 
           data.type && 
           data.timestamp &&
           Date.now() - data.timestamp < 5000; // 5s timeout
  }
}
```

### Reference View Isolation
- Each window has own memory space
- No direct DOM access between windows
- State sync via structured clone only
- No sensitive data in window.name

## Security Checklist

### Development
- [ ] All OAuth flows use PKCE
- [ ] WebCrypto API for all encryption
- [ ] No sensitive data in localStorage
- [ ] Content Security Policy headers
- [ ] Subresource Integrity for CDN assets
- [ ] API keys encrypted before storage
- [ ] Window messages validated

### Deployment
- [ ] HTTPS only (HSTS enabled)
- [ ] Secure headers (X-Frame-Options, etc.)
- [ ] Regular dependency updates
- [ ] Security scanning in CI/CD

### User Education
- [ ] Clear data storage warnings
- [ ] Backup recommendations
- [ ] Password strength requirements
- [ ] Phishing awareness

---

**Remember**: In our hybrid architecture, we balance security and functionality. Email content stays client-side for privacy, while metadata on servers enables powerful features. We've minimized server attack surface while maintaining full functionality.