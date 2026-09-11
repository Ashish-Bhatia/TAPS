import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl } from '../../../../lib/api';
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '../../../../lib/session';

/**
 * Proxies `POST /login`'s form submission to apps/api's
 * `POST /user-auth/login` (docs/api/user-auth.md) server-to-server, then
 * sets the returned JWT as an httpOnly cookie on apps/web's OWN domain
 * before redirecting to /dashboard.
 *
 * This is the core of ADR 016-web-session-cookie-strategy.md's chosen
 * pattern: apps/api (Fly.io) and apps/web (Vercel) are different domains,
 * so a `Set-Cookie` apps/api tried to send back directly to the browser
 * would never be sent back to apps/web's own later requests — cookies are
 * scoped per-domain, not per-application. Routing the login through this
 * Route Handler means the browser only ever talks to apps/web's own
 * origin, and the cookie it receives is set by (and therefore scoped to)
 * that same origin.
 *
 * A plain `<form action="/api/auth/login" method="POST">` (src/app/login/
 * page.tsx) posts here directly — no client-side JS/fetch needed, the same
 * "no client-side JS needed for a form" philosophy as the nav search box
 * (Header.tsx) and category dropdowns.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing_fields', request.url), 303);
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${apiUrl()}/user-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.redirect(new URL('/login?error=unknown', request.url), 303);
  }

  if (apiResponse.status === 401) {
    return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url), 303);
  }
  if (apiResponse.status === 400) {
    return NextResponse.redirect(new URL('/login?error=invalid_input', request.url), 303);
  }
  if (!apiResponse.ok) {
    return NextResponse.redirect(new URL('/login?error=unknown', request.url), 303);
  }

  const { accessToken } = (await apiResponse.json()) as { accessToken: string };

  // 303 (not the redirect() helper's default 307): a POST that succeeds
  // should have the browser follow up with a GET, not resubmit the form
  // body to /dashboard.
  const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url), 303);
  redirectResponse.cookies.set(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    // Only forces HTTPS-only in production — the real Vercel deployment
    // and Fly API are both HTTPS, but this also has to work over plain
    // http://localhost in local dev (see docs/adr/016-... "Verification").
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return redirectResponse;
}
