// ############################################################################
// DEPRECATED: LEGACY AUTHENTICATION UTILITIES
//
// This module contains authentication utilities for the deprecated direct
// Google OAuth system. It is scheduled for removal.
//
// DO NOT USE FOR NEW FEATURES.
//
// All new authentication should use Supabase Auth from the web app.
// See: apps/web/src/lib/supabase.ts for the correct implementation.
//
// For migration details, see: /API_DEPRECATION_PLAN.md
// Track progress: Issue #[TBD] - API App Phase-Out Epic
//
// Contact @tech-lead with any questions.
// ############################################################################

import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { Client } from 'pg';

// Types
export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthenticatedRequest extends NextRequest {
  user: AuthenticatedUser;
  auth: {
    user: AuthenticatedUser;
  };
}

// Database client
const getDbClient = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
};

/**
 * Authentication middleware for API routes
 */
export function withAuth(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<Response>
) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    try {
      // Get token from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid Authorization header' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify JWT token
      const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as any;
      
      // Get user from database
      const client = getDbClient();
      await client.connect();
      
      const result = await client.query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [decoded.sub]
      );
      
      await client.end();
      
      if (result.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const user = result.rows[0];
      
      // Attach user to request
      (request as AuthenticatedRequest).user = user;
      (request as AuthenticatedRequest).auth = { user };
      
      return handler(request as AuthenticatedRequest, context);
    } catch (error) {
      console.error('Authentication error:', error);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Get Google OAuth tokens for user
 */
export async function getGoogleTokens(userId: string) {
  const client = getDbClient();
  await client.connect();
  
  try {
    const result = await client.query(
      'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('No Google tokens found for user');
    }
    
    return result.rows[0];
  } finally {
    await client.end();
  }
}

/**
 * Update Google OAuth tokens
 */
export async function updateGoogleTokens(userId: string, tokens: {
  access_token: string;
  refresh_token?: string;
  expires_at: Date;
}) {
  const client = getDbClient();
  await client.connect();
  
  try {
    await client.query(
      `INSERT INTO google_auth_tokens (user_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, google_auth_tokens.refresh_token),
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [userId, tokens.access_token, tokens.refresh_token, tokens.expires_at]
    );
  } finally {
    await client.end();
  }
}