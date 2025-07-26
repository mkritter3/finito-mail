// ############################################################################
// DEPRECATED: LEGACY AUTHENTICATION MODULE
//
// This module handles authentication via direct Google OAuth and is deprecated.
// It is scheduled for removal.
//
// DO NOT USE FOR NEW FEATURES.
//
// All new authentication should be handled via Supabase OAuth in the web app.
// See: apps/web/src/app/auth/page.tsx for the correct implementation.
//
// For migration details, see: /API_DEPRECATION_PLAN.md
// Track progress: Issue #[TBD] - API App Phase-Out Epic
//
// Contact @tech-lead with any questions.
// ############################################################################

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { randomBytes } from 'crypto';

/**
 * @deprecated Use Supabase OAuth instead
 * GET /api/auth/google - Start Google OAuth flow with CSRF protection
 */
export async function GET(_request: NextRequest) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/callback`
    );

    // Generate cryptographically secure state parameter for CSRF protection
    const state = randomBytes(32).toString('hex');

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      state: state // CSRF protection
    });

    // Create response with auth URL
    const response = NextResponse.json({ authUrl });

    // Set secure httpOnly cookie with state parameter
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google/callback',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 });
  }
}