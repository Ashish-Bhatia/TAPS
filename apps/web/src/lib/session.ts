import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Session handling for TAPS-5.0.5 — see docs/adr/016-web-session-cookie-strategy.md
 * for the full "why" (apps/web on Vercel and apps/api on Fly.io are
 * different domains, so a cookie apps/api tried to set itself would never
 * reach apps/web's own server-side requests).
 *
 * The short version: this cookie is set by apps/web ON ITS OWN DOMAIN
 * (src/app/api/auth/login/route.ts, .../register/route.ts), holding the
 * `accessToken` JWT that apps/api's `POST /user-auth/login`/`register`
 * already returns (docs/api/user-auth.md) — apps/api needed no changes at
 * all for this, since that response shape already fits this pattern
 * exactly. apps/web then forwards it as a normal `Authorization: Bearer`
 * header on its own server-to-server fetches to apps/api (src/lib/api.ts's
 * `getMyQuizAttempts`), the same way any other bearer-JWT client would.
 */
export const SESSION_COOKIE_NAME = 'taps_session';

// Matches apps/api's user-session JWT expiry exactly
// (apps/api/src/user-auth/user-auth.module.ts: `signOptions: { expiresIn: '7d' }`).
// There's no shared config between the two apps to read this from, so it's
// kept in sync by hand — if that expiry ever changes, this must change
// with it, or the cookie could outlive (or expire well before) the token
// it holds.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Reads the session cookie without redirecting. For call sites where "not
 * logged in" is a legitimate state to just render around — e.g. the
 * header, which shows different links depending on whether there's a
 * session, but must never redirect just for rendering itself.
 */
export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * The Data Access Layer's `verifySession()`, per Next.js 16's own
 * recommended auth pattern (node_modules/next/dist/docs/01-app/02-guides/
 * authentication.md, "Creating a Data Access Layer (DAL)") — the real,
 * authoritative gate for a protected Server Component page, called at the
 * top of the page itself. Because the page is an async Server Component
 * that hasn't rendered anything yet, `redirect()` here sends the browser
 * to /login before a single byte of protected content is produced — there
 * is no client-side flash, unlike a client-only guard that renders first
 * and redirects after a `useEffect`.
 *
 * This only checks *presence* of the cookie (an "optimistic" check in the
 * docs' terminology, same as proxy.ts's), not the JWT's signature/expiry —
 * apps/web has no `USER_JWT_SECRET` and deliberately never will, matching
 * ADR 014's blast-radius reasoning for keeping the admin/user token
 * secrets apart (apps/web is a public-facing app; giving it a secret
 * capable of forging user sessions would be a strictly worse trust
 * boundary than giving it none). The real signature/expiry check happens
 * where it always has: apps/api's `UserJwtAuthGuard`, on every
 * authenticated fetch. `clearSessionAndRedirectToLogin()` below is what
 * runs when that check fails on a cookie that passed this one (a stale or
 * tampered token).
 */
export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) {
    redirect('/login');
  }
  return token;
}

/**
 * Called when apps/api's `UserJwtAuthGuard` rejects a token this cookie
 * held (`UnauthorizedApiError`, src/lib/api.ts) — i.e. the cookie was
 * present (so `requireSessionToken()` let the page through) but the token
 * itself is invalid or expired. Clears the now-useless cookie so the next
 * visit's optimistic checks (proxy.ts, `requireSessionToken`) correctly
 * treat this visitor as logged out too, instead of redirecting them into a
 * login/dashboard loop.
 */
export async function clearSessionAndRedirectToLogin(): Promise<never> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}
