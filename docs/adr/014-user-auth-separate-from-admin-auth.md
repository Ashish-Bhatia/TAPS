# 014 — User auth is a separate system from admin auth

Status: Accepted

## Context

`TAPS-5.1` builds the first real `User` model and end-user login/registration —
`docs/adr/005-admin-auth-and-validation.md` explicitly deferred this ("revisit when EPIC 5 lands a
real `User` table," now happening). The admin CMS auth already built (`AuthService`,
`JwtAuthGuard`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `apps/api/src/auth/`) exists to protect a
handful of content-management endpoints behind one shared operator credential. It would be
possible to extend that same module to also cover end-user accounts — one `AuthService`, one
guard, one JWT payload shape distinguishing `role: 'admin' | 'user'`. This ADR is about why that
was rejected in favor of a fully separate system, `apps/api/src/user-auth/`.

## Decision

`apps/api/src/user-auth/` is a new module that shares nothing at runtime with
`apps/api/src/auth/` beyond an implementation detail (the bcrypt salt-round count, `10`, copied
because it's the right value, not because the modules are coupled):

- Separate identity source: admin auth checks a password against one env var
  (`ADMIN_PASSWORD_HASH`); user auth checks a password against a `User` row's own `passwordHash`
  looked up by email.
- Separate JWT signing key: `UserAuthModule` registers its own `JwtModule` keyed on
  `USER_JWT_SECRET`, not the admin module's `JWT_SECRET`. These are two different secrets, not one
  secret read by two guards.
- Separate guard: `UserJwtAuthGuard`, structurally similar to `JwtAuthGuard` (same "plain
  `CanActivate` over `@nestjs/jwt`'s `JwtService.verifyAsync`, not `@nestjs/passport`'s `AuthGuard`
  mixin" approach from ADR 005 §2) but with its own `JwtService` instance and its own token
  verification path — it never touches `JWT_SECRET` or the admin guard's code at all.
- Separate claim shape: the admin JWT payload is `{ sub: 'admin', role: 'admin' }`
  (`apps/api/src/auth/jwt-payload.interface.ts`); the user JWT payload is `{ userId, email }`
  (`apps/api/src/user-auth/user-jwt-payload.interface.ts`) — no `role` or `admin` claim exists in
  it at all, so there is no field a bug could fail to check.

## Why: blast radius, not just "how"

The two systems protect different things with very different consequences if compromised. An
admin token grants CMS write access — creating/editing/deleting `ExamBoard`/`Post`/etc. across the
whole site. A user token grants access to one person's own account/progress data. The security
property this design is actually buying is: **a compromised or forged token from one system must
never grant any capability in the other**, in either direction.

Sharing a JWT signing secret between the two systems — even with different claim shapes checked by
different guards — would make that property depend entirely on every guard, forever, correctly
and exhaustively checking claim shape before trusting a token, with zero tolerance for a future
guard that (like the current admin `JwtAuthGuard`, which does not itself re-check `payload.role`)
trusts _any_ successfully-verified payload. A single missed check, in either guard, at any point in
the future, would let a token from one system pass validation in the other. Using two different
signing secrets removes this failure mode structurally rather than relying on discipline: a token
signed with `JWT_SECRET` fails signature verification outright against a `JwtService` configured
with `USER_JWT_SECRET`, and vice versa — `UserJwtAuthGuard` never gets far enough to look at claim
contents for an admin-issued token, because the token isn't a valid JWT under its key at all. This
was verified directly (`user-jwt-auth.guard.spec.ts`'s "vs admin-issued tokens" block): a real
token signed by a `JwtService` configured with `JWT_SECRET` is rejected by `UserJwtAuthGuard`
before the guard ever reads `userId`/`email` off it.

Reusing `AuthService`/`JwtAuthGuard` directly (one guard, a `role` branch) was also rejected for a
more basic reason: it reintroduces exactly the shared-secret risk above by construction, and it
means every future change to admin auth (e.g. a `TAPS-2.5`-style dependency bump touching
`@nestjs/jwt`) is a change that can affect user auth too, and vice versa — two systems with very
different threat models (one operator credential vs. many self-registered accounts; no
registration flow vs. a public registration endpoint that is itself an attack surface —
enumeration, credential stuffing — the admin system was never designed to resist) coupled through
one module for no benefit either side needed.

## Consequences

- **Easier:** the blast-radius property above holds structurally, not by convention; either
  system's secret can be rotated independently without affecting the other; `apps/api/src/auth/`
  needed zero changes for this story — no risk of a user-auth change regressing admin auth.
  `UserAuthService.login` also has its own enumeration-safety responsibility (a nonexistent-email
  login must not be distinguishable from a wrong-password one) that the single-admin-credential
  system never needed at all (there's exactly one identity to guess), which is a genuinely
  separate testing/design concern.
- **Harder:** two guards, two JWT payload interfaces, two DTOs, two env vars to configure
  (`JWT_SECRET` and `USER_JWT_SECRET`) instead of one — a deliberate duplication of a small amount
  of boilerplate (see the near-identical `JwtAuthGuard`/`UserJwtAuthGuard` structure) in exchange
  for the isolation above. If a third, larger authenticated surface is ever added, a shared
  low-level JWT-verification helper (still with per-system secrets/guards) might be worth
  extracting then — not preemptively here.
- User sessions are longer-lived than admin ones (7 days vs. 12 hours,
  `UserAuthModule`'s `JwtModule.register`) — a consumer login persisting across visits is a
  different UX expectation than a CMS operator's working session, and the two being on unrelated
  secrets/guards means this expiry choice for one has no bearing on the other's security posture.
- Migration + live verification: the `User` model's migration
  (`prisma/migrations/20260911120221_add_user_model/`) was applied to the real Neon database via
  the hand-write-SQL + `prisma migrate deploy` path (`docs/runbooks/database-migrations.md`) — the
  same documented `_prisma_migrations` residue from `TAPS-3.8`/`TAPS-4.0` recurred verbatim
  (`migrate dev` refuses with "modified after it was applied"/wants a full reset), confirming the
  runbook's "treat `migrate dev` as permanently unusable against this database" guidance rather
  than needing to re-derive a fix. `prisma migrate status` confirms "up to date," and a live
  create → read (by unique email) → delete round trip against the real `users` table left no
  residue (0 rows remaining). The full `/user-auth/register` → duplicate-email 409 →
  `/user-auth/login` success/wrong-password/nonexistent-email flows were also exercised live
  against a running server backed by the real Neon DB (not just mocked unit tests), including
  decoding an issued JWT to directly confirm its payload is exactly `{ userId, email, iat, exp }`
  with no `role`/`admin` claim; the smoke-test row was deleted afterward (confirmed: 0 remaining).
