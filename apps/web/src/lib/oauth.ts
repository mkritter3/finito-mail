/**
 * OAuth 2.0 PKCE (Proof Key for Code Exchange) utilities
 * Used for secure OAuth flows without client secrets in browser
 */
import { randomBytes, createHash } from 'crypto'

/**
 * Generate a cryptographically random code verifier
 */
export function generateCodeVerifier(): string {
  return base64URLEncode(randomBytes(32))
}

/**
 * Generate code challenge from verifier using SHA256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash('sha256')
  hash.update(verifier)
  return base64URLEncode(hash.digest())
}

/**
 * Base64 URL encoding (RFC 4648 §5)
 */
function base64URLEncode(buffer: Buffer | Uint8Array): string {
  const base64 = Buffer.from(buffer).toString('base64')
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}