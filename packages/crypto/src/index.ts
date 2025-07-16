/**
 * Client-side encryption utilities using WebCrypto API
 */

export class CryptoService {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;
  private readonly saltLength = 16;
  private readonly ivLength = 12;
  private readonly iterations = 100000;

  /**
   * Generate a cryptographically secure random key
   */
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: this.algorithm,
        length: this.keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derive a key from a password using PBKDF2
   */
  async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
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
        iterations: this.iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      {
        name: this.algorithm,
        length: this.keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data with a key
   */
  async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv,
      },
      key,
      encoder.encode(data)
    );

    return { ciphertext, iv };
  }

  /**
   * Decrypt data with a key
   */
  async decrypt(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Encrypt sensitive data (like API keys) with a user's password
   */
  async encryptWithPassword(data: string, password: string): Promise<{
    encrypted: string;
    salt: string;
    iv: string;
  }> {
    const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
    const key = await this.deriveKeyFromPassword(password, salt);
    const { ciphertext, iv } = await this.encrypt(data, key);

    return {
      encrypted: this.arrayBufferToBase64(ciphertext),
      salt: this.arrayBufferToBase64(salt.buffer as ArrayBuffer),
      iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
    };
  }

  /**
   * Decrypt data encrypted with a password
   */
  async decryptWithPassword(
    encrypted: string,
    password: string,
    salt: string,
    iv: string
  ): Promise<string> {
    const saltBuffer = this.base64ToArrayBuffer(salt);
    const ivBuffer = new Uint8Array(this.base64ToArrayBuffer(iv));
    const ciphertext = this.base64ToArrayBuffer(encrypted);

    const key = await this.deriveKeyFromPassword(password, new Uint8Array(saltBuffer));
    return this.decrypt(ciphertext, key, ivBuffer);
  }

  /**
   * Generate a secure random string for tokens
   */
  generateSecureToken(length = 32): string {
    const array = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash data using SHA-256
   */
  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Create a HMAC signature
   */
  async createHmac(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return this.arrayBufferToBase64(signature);
  }

  /**
   * Verify a HMAC signature
   */
  async verifyHmac(data: string, signature: string, secret: string): Promise<boolean> {
    const expectedSignature = await this.createHmac(data, secret);
    return signature === expectedSignature;
  }

  // Utility methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export a singleton instance
export const cryptoService = new CryptoService();