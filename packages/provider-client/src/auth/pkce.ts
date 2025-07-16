import { cryptoService } from '@finito/crypto';

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

export class PKCEService {
  /**
   * Generate PKCE challenge for OAuth flow
   */
  async generateChallenge(): Promise<PKCEChallenge> {
    // Generate code verifier - random 128 character string
    const codeVerifier = cryptoService.generateSecureToken(64);
    
    // Generate code challenge - SHA256(codeVerifier)
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to base64url
    const bytes = new Uint8Array(digest);
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    const codeChallenge = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Build authorization URL for OAuth flow
   */
  buildAuthorizationUrl(params: {
    authEndpoint: string;
    clientId: string;
    redirectUri: string;
    scope: string;
    codeChallenge: string;
    state?: string;
    additionalParams?: Record<string, string>;
  }): string {
    const url = new URL(params.authEndpoint);
    
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', params.scope);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    
    if (params.state) {
      url.searchParams.set('state', params.state);
    }
    
    // Add any provider-specific params
    if (params.additionalParams) {
      Object.entries(params.additionalParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(params: {
    tokenEndpoint: string;
    clientId: string;
    redirectUri: string;
    code: string;
    codeVerifier: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
    scope?: string;
  }> {
    const response = await fetch(params.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        code: params.code,
        code_verifier: params.codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(params: {
    tokenEndpoint: string;
    clientId: string;
    refreshToken: string;
  }): Promise<{
    accessToken: string;
    expiresIn: number;
    tokenType: string;
    scope?: string;
  }> {
    const response = await fetch(params.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: params.clientId,
        refresh_token: params.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }
}

export const pkceService = new PKCEService();