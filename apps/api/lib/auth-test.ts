import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { AuthenticatedRequest, AuthenticatedUser, withAuth as prodWithAuth } from './auth';

/**
 * Test-specific authentication middleware that handles mock users
 * Only used when E2E_TESTING=true
 */
export function withTestAuth(
  handler: (request: AuthenticatedRequest, context?: any) => Promise<Response>
) {
  // In production or when E2E_TESTING is not set, use the production auth middleware
  if (process.env.NODE_ENV === 'production' || process.env.E2E_TESTING !== 'true') {
    return prodWithAuth(handler);
  }

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
      
      // Verify JWT token - use same secret as mock endpoint
      const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('No JWT secret configured for test auth');
      }

      const decoded = verify(token, jwtSecret) as any;
      
      // Check if this is a mock user
      if (decoded.isMockUser) {
        // For mock users, construct the user object from the JWT payload
        const user: AuthenticatedUser = {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.name,
        };
        
        // Attach user to request
        (request as AuthenticatedRequest).user = user;
        (request as AuthenticatedRequest).auth = { user };
        
        return handler(request as AuthenticatedRequest, context);
      } else {
        // For non-mock users, use the production auth flow
        return prodWithAuth(handler)(request, context);
      }
    } catch (error) {
      console.error('Test authentication error:', error);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

// Re-export the withAuth function - when testing, it uses the test version
export const withAuth = process.env.E2E_TESTING === 'true' ? withTestAuth : prodWithAuth;