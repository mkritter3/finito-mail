import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-test';

/**
 * GET /api/auth/me - Get current user info
 */
export const GET = withAuth(async (request) => {
  return NextResponse.json({ user: request.user });
});