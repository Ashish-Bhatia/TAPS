# 023 — `apps/mobile`: `expo-secure-store` for JWT storage

Status: Accepted

## Context

`TAPS-6.2` adds a login screen consuming `TAPS-5.1`'s `POST /user-auth/login`
(`docs/api/user-auth.md`), and needs somewhere to persist the returned JWT between app launches —
otherwise every cold start would require logging in again. `apps/web`'s equivalent (`TAPS-5.0.5`)
used an httpOnly cookie (`docs/adr/016-web-session-cookie-strategy.md`), but that pattern exists
specifically to work around `apps/api` (Fly.io) and `apps/web` (Vercel) being different browser
domains — a native app has no such problem: `apps/mobile` calls `apps/api` directly, so the token
can just be sent as a normal `Authorization: Bearer` header, same as any other bearer-JWT client.
The only real decision is _where the token lives on the device_ between launches.

Sprint 6 planning specified `expo-secure-store` directly (not left open as a comparison this ADR
needs to re-litigate), for a concrete reason worth recording: `expo-secure-store` wraps the OS's own
encrypted storage (Android Keystore / iOS Keychain), while the more commonly-reached-for
`@react-native-async-storage/async-storage` persists as **plaintext** on disk. A session JWT is a
bearer credential — anyone who can read it can act as that user against `apps/api` for the token's
full 7-day lifetime (`docs/api/user-auth.md`'s expiry) — so storing it unencrypted on a device that
could be lost, rooted, or backed up unencrypted is a real, avoidable exposure `expo-secure-store`
closes for the cost of a slightly smaller storage quota (a few KB per key, far more than a JWT
needs) and no synchronous API (irrelevant here — every call site already awaits it).

## Decision

`src/lib/auth.ts` stores `{ accessToken, email }` as one JSON string under a single
`expo-secure-store` key (`taps_session`) — the email is the one the user typed at login, not
decoded from the JWT client-side, since nothing in this app needs to read the token's own payload
(unlike, say, displaying claims from it) and decoding it would need a base64/JSON-in-JWT helper for
no real benefit over just remembering what was typed. `src/lib/AuthContext.tsx` wraps the app
(`app/_layout.tsx`) and restores this on mount, exposing `status`/`email`/`token`/`login`/`logout`
to every screen via `useAuth()` — `TAPS-6.3`/`6.4`'s screens gate on this rather than each
re-reading `expo-secure-store` independently, and can call `src/lib/auth.ts`'s `apiFetchAuthed`
(mirroring `apps/web/src/lib/api.ts`'s `apiFetchAuthed`) for their own authenticated fetches.

## A real bug found while verifying this story (not part of the storage decision, but caused by it)

Verifying `TAPS-6.2`'s screens the same way `TAPS-6.1`'s were (`expo-router/testing-library`'s
`renderRouter`, real route files, mocked `fetch`) surfaced a real, already-merged regression:
`TAPS-6.1`'s render tests (`app/index.test.tsx`, `app/exam-boards/[id].test.tsx`) were colocated
directly inside `app/`, matching this repo's usual colocated-`*.test.ts(x)` convention
(`06-CODING-STANDARDS.md`). Expo Router's own docs are explicit that this is wrong: "do not put
your test files inside the **app** directory... all files inside your app directory must be either
routes or layout files." Confirmed for real, not just from the docs: `npx expo export --platform
android` failed outright once those test files existed, because Expo Router's route-discovery
context picked up `expo-router/testing-library`'s own `import "path"` (a Node core module, unusable
in a React Native bundle) as part of the app's route graph. This had been silently broken on
`develop` since `TAPS-6.1`'s second commit — nobody had re-run `expo export` after adding those
tests, so the break went unnoticed until this story explicitly re-checked it (see
`docs/backlog/BACKLOG.md`'s `TAPS-6.1` row for the correction).

**Fix:** all four render-test files (`TAPS-6.1`'s two, `TAPS-6.2`'s two new ones) moved to
`apps/mobile/__tests__/`, mirroring their route paths (`__tests__/index.test.tsx`,
`__tests__/exam-boards/[id].test.tsx`, `__tests__/login.test.tsx`, `__tests__/account.test.tsx`) —
outside `app/` entirely, per Expo Router's own convention, and still discovered automatically by
`jest-expo`'s default `testMatch` (`**/__tests__/**/*.[jt]s?(x)`). `renderRouter`'s first argument
stays `'./app'` in every file — confirmed by testing it, not assumed: that path resolves from the
Jest process's root directory (`apps/mobile`), not from the test file's own location, so it did not
need to change when the files moved. `npx expo export --platform android` re-run afterward: real
success, 1246 modules (fewer than the broken run's 1675 — `expo-router/testing-library` and its
`path` import are no longer pulled into the route graph at all). **Going forward: any new
colocated-with-a-route render test in `apps/mobile` belongs in `__tests__/`, never directly in
`app/`** — `src/lib/*.test.ts` (no route files involved) is unaffected and stays colocated as
before.

## Consequences

- No `packages/types`-style sharing between `apps/mobile`'s and `apps/web`'s auth/session modules —
  same reasoning as ADR 022's for the public-content client; the two apps' session mechanisms are
  different enough (bearer header vs. httpOnly cookie) that there would be little to share even if
  the workspace existed.
- `apps/mobile` never decodes or verifies the JWT client-side — same trust boundary reasoning as
  `apps/web`'s `requireSessionToken()` (ADR 016): the real signature/expiry check happens exactly
  where it always has, `apps/api`'s `UserJwtAuthGuard`, on every authenticated fetch.
- `getStoredSession()` treats a corrupted/unparseable stored value the same as "nothing stored"
  (returns `null` rather than throwing) — this module is the only writer of this key, so corruption
  isn't expected, but failing to a safe (logged-out) state costs nothing and avoids a crash on
  launch if it ever happens.

**Revisit when:** a "remember me" / longer-than-7-day session, or a refresh-token flow, becomes a
real requirement — this story's `{ accessToken, email }` shape has no room for either without a
schema change.
