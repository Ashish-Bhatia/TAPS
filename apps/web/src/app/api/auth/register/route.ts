import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl } from '../../../../lib/api';
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '../../../../lib/session';

/**
 * Same proxy pattern as ../login/route.ts, for apps/api's
 * `POST /user-auth/register` (docs/api/user-auth.md) — see that file's doc
 * comment and docs/adr/016-web-session-cookie-strategy.md for the full
 * cross-domain reasoning. Registration also returns an `accessToken`, so a
 * successful registration logs the new user in immediately (sets the same
 * session cookie and redirects straight to /dashboard) rather than sending
 * them to /login to sign in again with the credentials they just typed.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  const name = formData.get('name');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.redirect(new URL('/register?error=missing_fields', request.url), 303);
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${apiUrl()}/user-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        // RegisterDto's `name` is optional — omit the field entirely
        // rather than sending an empty string, matching how an unfilled
        // optional input should behave.
        ...(typeof name === 'string' && name ? { name } : {}),
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.redirect(new URL('/register?error=unknown', request.url), 303);
  }

  if (apiResponse.status === 409) {
    return NextResponse.redirect(new URL('/register?error=email_taken', request.url), 303);
  }
  if (apiResponse.status === 400) {
    return NextResponse.redirect(new URL('/register?error=invalid_input', request.url), 303);
  }
  if (!apiResponse.ok) {
    return NextResponse.redirect(new URL('/register?error=unknown', request.url), 303);
  }

  const { accessToken } = (await apiResponse.json()) as { accessToken: string };

  const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url), 303);
  redirectResponse.cookies.set(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return redirectResponse;
}
