# Sprint 1 — EPIC 2: Content Data Model + CMS/Admin

Sprint dates: 2026-09-10 (single continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `64f2767` (Sprint 0 close-out). Result: `develop` at
`b066dd8`, five PRs merged, CI green on every one, verified again from a clean `npm ci` checkout
after the last merge.

## What shipped

| Story       | PR                                                   | Summary                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TAPS-2.1`  | [#11](https://github.com/Ashish-Bhatia/TAPS/pull/11) | Prisma schema for `ExamBoard`, `Post`, `Syllabus`, `PastPaper`, `StudyMaterial`, `Book`, matching `05-ARCHITECTURE.md` §4, with relations/FKs and indexes on `examBoardId`/`subject`/`year`/`slug`. `docs/architecture/data-model.md` (new), `docs/adr/004-content-schema-design.md` (new).                                                                                                            |
| `TAPS-2.2`  | [#12](https://github.com/Ashish-Bhatia/TAPS/pull/12) | `PrismaModule`/`PrismaService` wired into `apps/api`; first migration applied to the **real Neon database**; connectivity confirmed with a live create→read→delete round trip, not just a clean migration exit code. `docs/runbooks/database-migrations.md` (new), `docs/adr/003-prisma-orm-and-connection-strategy.md` (new).                                                                         |
| `TAPS-2.3`  | [#13](https://github.com/Ashish-Bhatia/TAPS/pull/13) | Admin-only JWT-gated CRUD for `ExamBoard`/`Post` — login endpoint, guard, `class-validator` DTOs, Prisma-error→HTTP mapping. Manually exercised end-to-end against the real Neon database (login, unauthorized access, create, validation errors, 404/409 paths, delete), not only mocked unit tests. `docs/api/{auth,exam-boards,posts}.md` (new), `docs/adr/005-admin-auth-and-validation.md` (new). |
| `TAPS-2.4`  | [#14](https://github.com/Ashish-Bhatia/TAPS/pull/14) | Seed script for the six launch exam boards (DSSSB, KVS, NVS, CTET, UPTET, HTET) — original wording, not copied from any source site; idempotent `upsert` keyed by a new `ExamBoard.name` unique constraint. The six rows are live in Neon as of this sprint. `docs/runbooks/database-seeding.md` (new).                                                                                                |
| `TAPS-1.15` | [#15](https://github.com/Ashish-Bhatia/TAPS/pull/15) | `apps/api/.env.example` rewritten with the real shapes `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `ALLOWED_ORIGIN` turned out to have once this epic actually exercised them (Neon pooled connection string, real Anthropic key format, the live Vercel prod origin), plus the `JWT_SECRET`/`ADMIN_PASSWORD_HASH` pair `TAPS-2.3` introduced.                                                            |

All five landed with passing CI, Jest-equivalent (Vitest) unit tests for new logic, and docs
updated in the same PR as the code per `07-DOCUMENTATION-STANDARDS.md` — none deferred to a
follow-up "docs pass."

## The ADR-005 auth pivot (two-strike rule triggered)

`TAPS-2.3`'s first implementation followed the standard, most commonly documented NestJS +
Passport pattern: a `passport-jwt` `Strategy` plus `class JwtAuthGuard extends AuthGuard('jwt') {}`.
This crashed the **entire app** at boot — including the deliberately dependency-free `/health`
endpoint — with an unresolvable `AuthModuleOptions` dependency error from `@nestjs/passport`'s own
`AuthGuard` mixin.

Two structurally different fixes were tried (registering the guard as an explicit `AuthModule`
provider, and deliberately not registering it) and both failed the same way. Per
`10-LOOP-PREVENTION-PROTOCOL.md` Rule 1, a third variation of the same passport-mixin plumbing was
not attempted. Instead, `JwtAuthGuard` was rewritten as a plain `CanActivate` that verifies the JWT
directly via `@nestjs/jwt`'s `JwtService` — removing the `@nestjs/passport`/`passport`/
`passport-jwt` dependency chain entirely. This still satisfies `05-ARCHITECTURE.md`'s "JWT auth"
choice (Passport's specific value — pluggable multi-strategy auth — was never needed here, since
this app only ever has one strategy). Full context, including the exact error text from both
failed attempts, is in `docs/adr/005-admin-auth-and-validation.md`.

A second, smaller bug surfaced while manually verifying the fix end-to-end (not by unit tests
alone, which had mocked `JwtService` and so never exercised real env-var loading): `JWT_SECRET`
silently read as `undefined` because `AuthModule`'s `JwtModule.register()` reads it at module
decoration time, before Prisma Client's own incidental `.env` auto-load had run. Fixed with
`apps/api/src/load-env.ts`, using Node's built-in `process.loadEnvFile()` as the first import in
`main.ts` — see the same ADR.

## New backlog items filed (not folded into this sprint)

Found as direct byproducts of `TAPS-2.2`/`2.3` work, filed as separately-scoped follow-ups per
`10-LOOP-PREVENTION-PROTOCOL.md` Rule 3 (no silent scope creep) rather than fixed in-line:

- **TAPS-2.5** — Upgrade Prisma to a stable 7.x/8.x release with driver adapters, once that
  ecosystem settles (this sprint deliberately pinned to 6.19.3 — see ADR 003).
- **TAPS-2.6** — Wire `prisma migrate deploy` into `apps/api/fly.toml`'s `release_command` for
  automatic migrations on deploy (currently manual, documented in the runbook).
- **TAPS-2.7** — Add a DB-aware readiness check, separate from the deliberately DB-independent
  `/health`, now that a startup DB outage fails soft instead of crashing boot.
- **TAPS-2.8** — Revisit the `prisma` CLI's transitive `deepmerge-ts` high-severity advisory once
  a fixed release exists (devDependency-only, build-time, not runtime — not urgent).
- **TAPS-2.10** — Map Prisma's `P2003` (foreign-key constraint violation) in
  `PrismaExceptionFilter` — deleting an `ExamBoard` with attached `Syllabus`/`PastPaper` rows
  currently 500s instead of a clean 4xx.
- **TAPS-3.1** — Public (non-admin) read-only endpoints for `ExamBoard`/`Post` — `TAPS-2.3`'s CRUD
  is admin-only by design; `apps/web` needs a real, unauthenticated read path. Carried into the
  Sprint 2 proposal below.

## What moved

All five sprint stories: **Ready → Done.** No story was left mid-sprint or silently dropped.

## Retro

**What slowed the sprint down:** a real git merge conflict, not a process failure in the code
itself. `TAPS-2.4`'s branch was created from `develop`'s tip _before_ `TAPS-2.3`'s PR merged, but
its own PR wasn't opened until after `TAPS-2.3` had already merged — by which point both branches
had independently edited the same lines of `apps/api/package.json` and `docs/backlog/BACKLOG.md`.
The conflict was real (not a tooling glitch: GitHub's `pull_request` CI trigger silently never
fired for the affected PR because it couldn't compute a merge commit), and cost a full
merge-resolve-reverify cycle to fix. The same pattern then repeated for `TAPS-1.15` against
`TAPS-2.4`.

**One process change to try next sprint** (per `04-AGILE-PROCESS.md` §3): **always `git fetch` and
branch a new story off the actual current tip of `develop` — never off a commit checked out
earlier in the session — immediately before starting that story's work**, not just once at
sprint-planning time. For a sprint with several dependent stories landing in sequence, the base
branch moves between when a later story is _planned_ and when its PR is actually _opened_; treating
"branched from `develop`" as a one-time fact at the start of the session is what produced both
conflicts here. This costs nothing when there's no conflict and avoids a full merge-resolve cycle
when there is one.

## Sprint 2

Proposed backlog (public read API + EPIC 3 web app shell/search) is in `docs/backlog/BACKLOG.md`
under "Proposed — Sprint 2" status, pending Ashish's sprint planning approval per
`04-AGILE-PROCESS.md` §3 — not started.
