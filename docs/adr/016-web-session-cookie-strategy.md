# 016 — Web session/cookie strategy for a cross-domain frontend + API

Status: Accepted

## Context

`TAPS-5.0.5` is the missing prerequisite `TAPS-5.3` discovered: `apps/api`'s `POST /user-auth/
register`/`POST /user-auth/login` (`TAPS-5.1`, `docs/api/user-auth.md`) return a bearer JWT, but
nothing in `apps/web` ever obtains or holds one — no login/register page, no cookie, no client- or
server-side notion of "the current user" (see `docs/architecture/web-app.md`'s "Progress dashboard
(`TAPS-5.3`)" section for the original gap writeup). This story has to invent that session
mechanism, and do it correctly for how this app is actually deployed:

- `apps/api` runs on Fly.io at `https://taps-api.fly.dev`.
- `apps/web` runs on Vercel at `https://taps-web-eta.vercel.app` (Production; other branches get
  their own Preview URLs — `docs/runbooks/deploy-api.md` "CORS Configuration").

These are two different domains, not two paths on one domain. That rules out the naive approach
of having `apps/api` set a session cookie directly on its own `POST /user-auth/login` response and
expecting the browser to carry it back on later requests to `apps/web`: a cookie's `Set-Cookie` is
scoped to the domain that sent it (`taps-api.fly.dev`), so the browser would never attach it to a
request to `taps-web-eta.vercel.app`'s own server — from `apps/web`'s server-side perspective, the
visitor would look permanently logged out. This isn't a subtle edge case that only shows up in
production, either: it also doesn't work in local dev the moment `apps/web` and `apps/api` run on
different ports (`localhost:3000` vs `localhost:8080`), because a cookie's scope is host-based, not
port-based, but structurally the same mismatch — see "Verification" below for how that was used
deliberately to prove the real cross-domain case without deployed infrastructure.

## Decision

`apps/web` proxies auth through its own Route Handlers, which set the session cookie **on their
own domain**:

- `src/app/api/auth/login/route.ts` and `.../register/route.ts` accept a plain HTML form POST
  (`<form action="/api/auth/login" method="POST">`, no client-side JS/fetch — the same philosophy
  already used for the nav search box and category dropdowns), call `apps/api`'s
  `POST /user-auth/login`/`register` server-to-server (Node `fetch`, not a browser request), and on
  success set the returned `accessToken` as an httpOnly cookie (`taps_session`) on their own
  response before redirecting to `/dashboard`.
- `src/app/api/auth/logout/route.ts` deletes that cookie and redirects home. No call to `apps/api`:
  the JWT is stateless (no session table), so there is nothing server-side to invalidate.
- Every later authenticated request (`src/lib/api.ts`'s `getMyQuizAttempts`) reads the cookie
  server-side and forwards it as a normal `Authorization: Bearer <token>` header to `apps/api` —
  exactly the same header shape any other client of `UserJwtAuthGuard` uses
  (`docs/api/user-auth.md`). The browser never holds, sends, or even sees this header; it only ever
  talks to `apps/web`'s own origin.

**Why this works across the Fly/Vercel domain split:** the browser's only relationship is with
`apps/web`. It POSTs a form to `apps/web`'s own origin and gets a `Set-Cookie` back from that same
origin, so the cookie is correctly scoped to wherever `apps/web` is actually serving from — the
real Vercel domain in production, a Preview URL on a branch deploy, or `localhost:3000` in dev — as
this app's authoritative HTML front door already is for every other page today (an npm-workspaces
monorepo, not a Next-hosts-the-API micro-frontend). The Fly-hosted `apps/api` is never party to a
cookie exchange with the browser at all; it only ever sees a bearer header on a normal
server-to-server request, sent by `apps/web`'s own Node process — a plain "confidential client"
using a bearer token, not the token being smuggled across a domain boundary it doesn't belong to.

**`apps/api` needed zero code changes for this.** The task anticipated possibly needing a
different response shape or new endpoints "if the proxy pattern needs one" — it doesn't:
`POST /user-auth/login`/`register`'s existing `{ accessToken: string }` response
(`docs/api/user-auth.md`, unchanged since `TAPS-5.1`) is exactly what this pattern's Route Handlers
need to set the cookie themselves. `apps/api` still has no concept of a cookie, and deliberately
never will — it stays a plain bearer-JWT API, consumable identically by `apps/web`, a mobile client,
or `curl`.

### Session-check mechanism: Proxy + a Data Access Layer, not `middleware.ts`

`middleware.ts` is **deprecated in Next.js 16**, renamed `proxy.ts` (verified directly against this
exact installed version — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
middleware.md` — not assumed from older training data, per `apps/web/AGENTS.md`). Next's own current
auth guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) recommends two layers
together, and this story uses both:

1. **`src/proxy.ts`** — an "optimistic" pre-filter (cookie _presence_ only, never decoded) that
   redirects an unauthenticated visitor away from `/dashboard` before the route even renders, and
   redirects an already-authenticated visitor away from `/login`/`/register`. Scoped via `matcher`
   to just those routes, not every request.
2. **`src/lib/session.ts`'s `requireSessionToken()`** — the actual Data Access Layer check, called
   at the top of the `/dashboard` Server Component itself. Because the component is `async` and
   hasn't rendered anything before this call, `redirect()` sends the browser to `/login` before a
   single byte of protected content is produced — there is no client-side flash, regardless of
   whether Proxy ran first. This is the authoritative check Next's docs say Proxy should never be
   the only line of defense for.

Neither check verifies the JWT's signature or expiry — `apps/web` has no `USER_JWT_SECRET` and
deliberately never will, the same blast-radius reasoning ADR 014 already applied to keeping the
admin/user secrets apart, extended here to keeping any token-forging capability out of the
public-facing frontend entirely. The real signature/expiry check happens exactly where it always
has: `apps/api`'s `UserJwtAuthGuard`, on the one real authenticated fetch
(`getMyQuizAttempts`). A `401` from that guard (`UnauthorizedApiError`, `src/lib/api.ts`) — a stale
or tampered cookie that passed the presence check — is caught by the dashboard page, which clears
the cookie and redirects to `/login` itself (`clearSessionAndRedirectToLogin`), so the visitor
doesn't get stuck bouncing between the two optimistic checks forever.

### Alternatives considered

- **Client-side `localStorage` + a client-only guarded page.** Rejected: the token would be
  readable by any script on the page (XSS blast radius far larger than an httpOnly cookie), and a
  client-only guard renders the page first and redirects after a `useEffect` — exactly the
  client-side flash this story's acceptance criteria rule out.
- **`apps/api` sets the cookie itself, with `credentials: 'include'`/CORS tuned for it.** Rejected
  outright, not just as a worse option: this is the broken pattern the task flagged up front. Even
  with `Access-Control-Allow-Credentials` and a matching `Access-Control-Allow-Origin`, a cookie
  `apps/api` sets is still scoped to `taps-api.fly.dev` — CORS controls whether a cross-origin
  _response_ is readable by the calling page's JS, it does not relocate where a cookie is scoped.
  `apps/web`'s later server-side requests to `apps/api` would still never receive it.

## Verification

Full `apps/web` suite: `npx vitest run` — 21 test files, 82/82 passing (18 new, covering
`src/lib/session.ts`, the `getMyQuizAttempts`/`UnauthorizedApiError` addition to `src/lib/api.ts`,
`/login`, `/register`, `/dashboard` (empty state, populated state, the `401`-clears-cookie path),
all three `/api/auth/*` Route Handlers, `src/proxy.ts`, and `Header.tsx`'s session-aware links), no
regressions in the other 4 pre-existing files. `npx eslint` clean. `npx tsc --noEmit` clean, and
`npm run build` succeeds with `/dashboard`, `/login`, `/register`, and all three `/api/auth/*`
routes present alongside a listed `Proxy (Middleware)` entry, confirming `src/proxy.ts` was picked
up. `apps/api`'s full suite re-run to confirm zero regressions from this story (it made no `apps/
api` code changes at all): `npx vitest run` — 33 test files, 137/137 passing, unchanged from
`TAPS-5.3`.

**Live cross-domain verification — what was and wasn't possible.** The task asked this to be
verified against the real deployed `taps-api.fly.dev`/`taps-web-eta.vercel.app`, not just localhost.
Both domains are reachable from this environment (confirmed: `curl https://taps-api.fly.dev/health`
→ `200`; `curl https://taps-web-eta.vercel.app/` → `200`). However, `taps-api.fly.dev` does **not**
yet run `TAPS-5.1`'s code — `curl -X POST https://taps-api.fly.dev/user-auth/register` returns a
plain `404 Cannot POST /user-auth/register`, not a `400`/`201` from the real handler. Checking `git
log origin/main..origin/develop`: `TAPS-5.1`/`5.2`/`5.3` (and everything since `TAPS-3.6`) exist only
on `develop`, not yet merged to `main` — and both Fly and Vercel Production only deploy from `main`
(`docs/runbooks/deploy-api.md`; Fly deploys are also founder-only account actions this session
cannot perform). So this story's actual dependency — a deployed `apps/api` with `user-auth` at all —
does not exist in production yet, independent of anything in this story; genuine live verification
against the two real deployed domains is currently blocked upstream on that deploy, not on
anything this session could fix.

What **was** verified live, for real, rather than skipped: `apps/api`'s `TAPS-5.1`/`5.2`/`5.3` code
was run locally against the real dev Neon database (the same one prior `TAPS-5.x` stories used),
bound to `0.0.0.0:8080` so it's reachable at two genuinely different hostnames — `localhost:8080`
and `127.0.0.1:8080` — and `apps/web` was built (`NEXT_PUBLIC_API_URL=http://127.0.0.1:8080`) and
run via `next start` on `localhost:3000`. `localhost` and `127.0.0.1` are different hostnames for
cookie-scoping purposes exactly the way `taps-web-eta.vercel.app` and `taps-api.fly.dev` are — this
reproduces the real cross-domain cookie mechanism, not merely two processes sharing one origin,
without needing the actual deployed infrastructure. Using `curl` as the browser stand-in, with a
cookie jar:

1. `GET http://localhost:3000/dashboard` with no session → `307` to `/login` (Proxy's optimistic
   check).
2. `POST http://localhost:3000/api/auth/register` (form-encoded, a throwaway
   `taps5-0-5-livecheck-…@example.com` address) → `303` to `/dashboard`, with a `Set-Cookie:
taps_session=<jwt>; HttpOnly; Secure; SameSite=lax` response header — confirming the real
   `apps/api` register call succeeded server-to-server and the cookie was set by `apps/web` itself.
3. `GET http://localhost:3000/dashboard` with that cookie jar → `200`, rendering "Your progress" /
   the zero-attempts empty state — confirming the cookie round-tripped correctly on `apps/web`'s own
   origin and its server successfully forwarded it as a bearer token to the real `apps/api`.
4. The **same cookie jar** pointed directly at `http://127.0.0.1:8080/quiz-attempts/me` (`apps/
api`'s own origin) sent **no `Cookie` header at all** (confirmed via `curl -v`) and got a plain
   `401` — proving the cookie genuinely never reaches `apps/api`, the exact property this ADR's
   decision depends on, demonstrated rather than assumed.
5. `GET http://localhost:3000/login` with the session cookie → `307` to `/dashboard` (Proxy's other
   branch). `POST .../api/auth/logout` → cookie cleared (confirmed via the jar file); `/dashboard`
   then `307`s to `/login` again. A login with the wrong password → `303` to
   `/login?error=invalid_credentials`; with the right password → `303` to `/dashboard`, which
   rendered successfully again.

The throwaway user row created for this (`taps5-0-5-livecheck-…@example.com`) was deleted from the
real dev database afterward via a direct Prisma query; a follow-up `findUnique` on that email
confirmed `null` — 0 rows remaining, no residue.

**Follow-up:** once `develop` merges to `main` and someone with Fly/Vercel deploy access (founder-
only, per `docs/runbooks/deploy-api.md`) redeploys both, the identical `taps-web-eta.vercel.app` →
`taps-api.fly.dev` flow should be spot-checked live the same way — it's the same mechanism, just
with the real hostnames instead of `localhost`/`127.0.0.1`, and nothing in this story's code is
hostname-specific. Not filed as a separate backlog item since it's a one-time post-deploy smoke
check, not new scope.
