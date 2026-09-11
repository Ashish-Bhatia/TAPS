import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/session';

/**
 * TAPS-5.0.5's optimistic auth check. `middleware.ts` is deprecated in
 * Next.js 16 and renamed `proxy.ts` (same behavior, new file/export names
 * — node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * middleware.md) — verified against this exact installed version rather
 * than assumed from older training data, per apps/web/AGENTS.md.
 *
 * This is only a fast pre-filter, not the real line of defense — it reads
 * cookie *presence*, never verifying the JWT inside it (matching Next's
 * own guidance, node_modules/next/dist/docs/01-app/02-guides/
 * authentication.md "Optimistic checks with Proxy (Optional)": Proxy runs
 * on every matched request, including prefetches, so it should stick to
 * cheap checks and never a database/signature check). The authoritative
 * check lives in src/lib/session.ts's `requireSessionToken()` (called by
 * the dashboard page itself, so an unauthenticated visitor is redirected
 * before any protected content renders — no client-side flash either
 * way) and, ultimately, apps/api's `UserJwtAuthGuard` on the actual
 * authenticated fetch.
 */
export default function proxy(request: NextRequest): NextResponse {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard') && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // A visitor who already has a session cookie has no reason to see the
  // login/register forms again — send them straight to the dashboard.
  if ((pathname === '/login' || pathname === '/register') && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Scopes Proxy to only the routes that actually need it, rather than
// running on every single request (every static/content page in this app
// has nothing to do with auth at all).
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
