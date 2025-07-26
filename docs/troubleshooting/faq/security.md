# Security FAQ

## Data Privacy

### Do you read my emails?

**No.** Finito Mail is designed with privacy-first architecture:
- Email bodies never touch our servers
- All processing happens in your browser
- We only sync metadata for features (snooze times, todos)
- No AI training on your data

### What data do you collect?

**Minimal metadata only:**
- Email headers (from, to, subject, date)
- User preferences and settings
- Usage analytics (optional, anonymized)
- Crash reports (with consent)

**Never collected:**
- Email bodies
- Attachments
- Contact details
- Personal information

### Where is my data stored?

**Your device:**
- Full emails in browser IndexedDB
- ~50GB capacity per browser
- Encrypted at rest by browser

**Our servers:**
- Minimal metadata in Redis
- Authentication tokens in Supabase
- No permanent email storage

### Can you access my Gmail account?

**Limited access only:**
- OAuth scopes are minimal (read, send, modify labels)
- No access to Google Drive or other services
- Tokens can be revoked anytime
- Access audited by Google

## Authentication Security

### How secure is the login process?

**Industry-standard security:**
- OAuth 2.0 with PKCE
- No passwords stored ever
- Tokens encrypted in transit
- Automatic token rotation
- Session timeout after inactivity

### What is PKCE?

**Proof Key for Code Exchange:**
- Additional OAuth security layer
- Prevents authorization code interception
- Required for public clients
- Implemented automatically

### Can someone steal my session?

**Multiple protections:**
- HttpOnly cookies (where applicable)
- Secure flag (HTTPS only)
- SameSite protection
- CSRF tokens
- Session fingerprinting

### How long do sessions last?

- **Active**: 24 hours with activity
- **Idle**: 2 hours timeout
- **Refresh**: Automatic token refresh
- **Maximum**: 7 days absolute

## Infrastructure Security

### Is the connection encrypted?

**Yes, everywhere:**
- HTTPS enforced (HSTS)
- TLS 1.3 minimum
- Certificate pinning planned
- No mixed content

### How do you prevent attacks?

**Defense in depth:**
- Rate limiting per user
- DDoS protection (Cloudflare)
- Input validation (Zod)
- SQL injection prevention
- XSS protection (React + CSP)

### What about CORS?

**Strict CORS policy:**
- Whitelist specific origins
- No wildcards in production
- Credentials require explicit origin
- Preflight checks enforced

### Do you have security audits?

**Regular security measures:**
- Automated dependency scanning
- OWASP Top 10 compliance
- Penetration testing (annual)
- Bug bounty program (planned)

## Email Security

### How are HTML emails handled?

**Safe rendering:**
- DOMPurify sanitization
- No external resource loading
- JavaScript stripped
- CSS isolation
- Iframe sandboxing

### Can I send encrypted emails?

**Not yet, but planned:**
- PGP support (Q3 2024)
- S/MIME support (Q4 2024)
- End-to-end encryption option
- Key management UI

### What about phishing protection?

**Multiple layers:**
- SPF/DKIM/DMARC validation
- Suspicious link warnings
- Domain similarity detection
- External link indicators
- Sender verification badges

### How do you handle attachments?

**Secure handling:**
- Virus scanning (planned)
- Type validation
- Size limits enforced
- Sandboxed preview
- No auto-download

## Compliance & Policies

### Are you GDPR compliant?

**Yes:**
- Data minimization
- Right to deletion
- Data portability
- Privacy by design
- DPA available

### What about CCPA?

**Yes:**
- California residents rights honored
- Data sale opt-out (we don't sell data)
- Deletion requests within 45 days
- Annual privacy report

### Do you have a bug bounty?

**Coming soon:**
- Responsible disclosure program active
- Bug bounty planned for Q2 2024
- Security email: security@finito-mail.com
- PGP key available

### What's your incident response?

**24-hour response:**
1. Immediate investigation
2. User notification if affected
3. Patch deployment
4. Post-mortem published
5. Preventive measures

## Best Practices

### How can I maximize security?

**User responsibilities:**
1. Use strong, unique password for Google
2. Enable 2FA on Google account
3. Review connected apps regularly
4. Report suspicious activity
5. Keep browser updated

### What should I avoid?

**Security tips:**
- Don't use on public WiFi without VPN
- Don't save passwords in browser
- Don't click suspicious links
- Don't forward tokens or URLs
- Don't disable security warnings

### How do I report security issues?

**Responsible disclosure:**
1. Email security@finito-mail.com
2. Encrypt with our PGP key
3. Include reproduction steps
4. Allow 90 days for fix
5. Coordinated disclosure

### What if my account is compromised?

**Immediate steps:**
1. Revoke OAuth access in Google
2. Change Google password
3. Review account activity
4. Contact support@finito-mail.com
5. Enable 2FA if not already