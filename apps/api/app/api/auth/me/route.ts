// ############################################################################
// DEPRECATED: This endpoint uses the legacy authentication system
//
// This endpoint is part of the deprecated API app authentication.
// New features should use Supabase Auth session management.
//
// For migration details, see: /API_DEPRECATION_PLAN.md
// ############################################################################

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-test';

/**
 * @deprecated Use Supabase session management instead
 * GET /api/auth/me - Get current user info
 */
export const GET = withAuth(async (request) => {
  return NextResponse.json({ user: request.user });
});