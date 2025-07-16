import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { sign } from 'jsonwebtoken';
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Database client
const getDbClient = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
};

/**
 * GET /api/auth/google/callback - Handle Google OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_WEB_URL}/auth?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_WEB_URL}/auth?error=no_code`
      );
    }

    if (!state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_WEB_URL}/auth?error=no_state`
      );
    }

    // Validate CSRF state parameter
    const stateCookie = request.cookies.get('oauth_state');
    if (!stateCookie || stateCookie.value !== state) {
      console.error('OAuth CSRF validation failed:', {
        cookieState: stateCookie?.value,
        urlState: state,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_WEB_URL}/auth?error=invalid_state`
      );
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const client = getDbClient();
    await client.connect();

    try {
      // Create or update user
      const userResult = await client.query(`
        INSERT INTO users (id, email, name, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
        RETURNING id, email, name
      `, [
        uuidv4(),
        userInfo.data.email,
        userInfo.data.name
      ]);

      const user = userResult.rows[0];

      // Store Google OAuth tokens
      const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600000));
      
      await client.query(`
        INSERT INTO google_auth_tokens (user_id, access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, google_auth_tokens.refresh_token),
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      `, [
        user.id,
        tokens.access_token,
        tokens.refresh_token,
        expiresAt
      ]);

      // Create JWT token
      const jwtToken = sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name
        },
        process.env.NEXTAUTH_SECRET!,
        {
          expiresIn: '7d'
        }
      );

      // Create redirect response
      const response = NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_WEB_URL}/auth/callback?token=${jwtToken}`
      );

      // Clear the OAuth state cookie after successful authentication
      response.cookies.delete('oauth_state');

      return response;
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_WEB_URL}/auth?error=auth_failed`
    );
  }
}