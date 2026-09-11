import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '../../../../lib/session';

/**
 * Deletes the session cookie and sends the visitor home. No call to
 * apps/api: the session JWT is stateless (docs/api/user-auth.md — nothing
 * server-side to invalidate, there's no session table), so "logging out"
 * is entirely a matter of apps/web forgetting the cookie it set itself.
 * A plain `<form action="/api/auth/logout" method="POST">` posts here
 * (Header.tsx) — same no-client-JS pattern as login/register.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
