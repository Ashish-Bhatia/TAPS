# 005 — Admin auth model, request validation, and Prisma error mapping

Status: Accepted

## Context

TAPS-2.3 adds admin-only CRUD for `ExamBoard` and `Post`, JWT-gated per `05-ARCHITECTURE.md`'s
"NextAuth / Passport (JWT)" auth choice, with input validation and proper REST error responses.
Three decisions here have real trade-offs per coding/documentation standards, so they get an ADR.

## 1. Admin auth without a User table

There's no `User` model yet — user accounts are EPIC 5, not started. Building a full
username/password/roles system just to protect a handful of CMS endpoints would be scope creep
ahead of the story that actually needs it (loop-prevention rule 3).

**Decision:** a single shared admin credential. `ADMIN_PASSWORD_HASH` (bcrypt, never the plaintext)
is an env var/secret; `POST /auth/login` compares a submitted password against it and, on match,
returns a signed JWT (`{ sub: 'admin', role: 'admin' }`, 12h expiry) from `AuthService`
(`apps/api/src/auth/auth.service.ts`). Every `ExamBoardController`/`PostController` route requires
that JWT via `JwtAuthGuard`. **Consequence:** one admin identity, no per-user audit trail or RBAC —
acceptable for this epic's scope, revisit when EPIC 5 lands a real `User` table.

## 2. Not using @nestjs/passport's `AuthGuard` mixin

The first implementation followed the standard documented pattern: a `passport-jwt` `Strategy` in
a `JwtStrategy`, and `class JwtAuthGuard extends AuthGuard('jwt') {}`. This **crashed the entire
app at boot** — including the deliberately dependency-free `/health` endpoint — with:

```
Error: Nest can't resolve dependencies of the JwtAuthGuard (?). Please make sure that the argument
AuthModuleOptions at index [0] is available in the ... module.
```

Two structurally different fixes were tried and both failed the same way (loop-prevention rule 1 —
two-strike rule): registering `JwtAuthGuard` as an explicit `AuthModule` provider, and _not_
registering it (relying on Nest's implicit per-module guard resolution) both hit unresolvable
`AuthModuleOptions`/`JwtService` dependency errors during Nest's eager provider instantiation at
app boot — even though `@Optional()` is correctly applied to that constructor param in
`@nestjs/passport`'s own `AuthGuard` mixin source. Rather than trying a third variation of the same
passport-mixin plumbing, we switched approach.

**Decision:** `JwtAuthGuard` is a plain `CanActivate` (`apps/api/src/auth/jwt-auth.guard.ts`) that
extracts a `Bearer` token from the `Authorization` header and verifies it directly via
`@nestjs/jwt`'s `JwtService.verifyAsync()` — no `@nestjs/passport`, `passport`, or `passport-jwt`
dependency at all. This app only ever needs one strategy (JWT); Passport's value is supporting
_multiple_ strategies, which isn't needed here, so the abstraction wasn't earning its keep. This
still satisfies the architecture doc's "JWT auth" choice — just via `@nestjs/jwt` directly rather
than through Passport's strategy-plugin layer.

**Also fixed while chasing this:** `AuthModule`'s `JwtModule.register({ secret:
process.env.JWT_SECRET })` reads `process.env.JWT_SECRET` at module **decoration time** (when
`auth.module.ts` is first imported), which happens before Prisma Client's own runtime finishes its
incidental `.env` auto-load (that only fires when a `PrismaClient` is actually _constructed_,
during Nest's later DI instantiation phase — see `node_modules/@prisma/client/runtime/library.js`).
Locally this meant `JWT_SECRET` silently read as `undefined` even with a correct `.env` file,
surfacing only at login time as `Error: secretOrPrivateKey must have a value` — a real bug, caught
by actually exercising `/auth/login` against a running server, not just unit tests (mocked
`JwtService` never exposed it). Fixed with `apps/api/src/load-env.ts`, a side-effect-only module
imported as the literal first line of `main.ts`, using Node's built-in `process.loadEnvFile()`
(guarded with try/catch for production, where there's no `.env` file at all — Fly secrets are
already in `process.env` before Node starts). No new dependency needed.

## 3. class-validator + class-transformer, global `ValidationPipe`

**Decision:** `class-validator`/`class-transformer` DTOs (`CreateExamBoardDto`, `UpdatePostDto`,
etc.) validated by a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true,
transform: true })` in `main.ts`. This is the NestJS-idiomatic default (official docs use exactly
this pairing) — "boring, well-documented tech" per `05-ARCHITECTURE.md` §1, not a close call
against a real competitor the way the Prisma version/connection decisions were (ADR 003).
`forbidNonWhitelisted` rejects requests carrying unknown fields outright (400) rather than
silently dropping them, which is safer for an admin API where a silently-ignored field could mask
a client bug.

**Prisma error → HTTP mapping:** `PrismaExceptionFilter`
(`apps/api/src/common/prisma-exception.filter.ts`), registered globally via `APP_FILTER`, maps
Prisma's `P2025` ("record to update/delete not found") to 404 and `P2002` (unique constraint,
e.g. `Post.slug`) to 409. Any other Prisma error code still 500s — an unmapped DB error is an
operational problem to investigate, not a client-facing 4xx to paper over.

## Consequences

- **Easier:** one fewer runtime dependency chain (`@nestjs/passport`/`passport`/`passport-jwt`
  removed); the JWT verification path is a single file anyone can read top to bottom without
  needing to also understand Passport's strategy-registration model; `/health` boots regardless of
  auth/DB config, consistent with ADR 003's precedent.
- **Harder:** if a second auth strategy is ever needed (e.g. OAuth for EPIC 5's real user
  accounts), Passport's multi-strategy plumbing would need to be introduced then — deferred, not
  avoided permanently.
- Manually verified end-to-end against the real Neon database (not just mocked unit tests):
  login with wrong password → 401; correct password → real signed JWT; unauthenticated
  `GET /exam-boards` → 401; authenticated create → 201 with a real row in Neon; invalid enum value
  → 400 with a clear message; an extra unknown field → 400; update of a nonexistent id → 404 via
  `PrismaExceptionFilter`; duplicate `Post.slug` → 409; delete → 204; all verification rows deleted
  afterward, leaving no residue in the database.
