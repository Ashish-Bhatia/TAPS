# 003 — Prisma version pin and lazy connection strategy

Status: Accepted

## Context

TAPS-2.2 wires Prisma to the real Neon Postgres instance via a `PrismaModule` in `apps/api`.
Two decisions came up while doing that which `05-ARCHITECTURE.md` doesn't settle and which have
real trade-offs, so per `06-CODING-STANDARDS.md` / `07-DOCUMENTATION-STANDARDS.md` they get an
ADR rather than a silent pick.

**1. Which Prisma major version.** `npm install prisma @prisma/client` (no version pin) resolved
`prisma@8.0.0-rc.13` (the npm `latest` dist-tag currently points at a Prisma 7 release candidate)
alongside `@prisma/client@7.10.0` — a mismatched CLI/client pair on its own, and `prisma validate`
against that CLI immediately fails:

```
Error: The datasource property `url` is no longer supported in schema files. Move connection URLs
for Migrate to `prisma.config.ts` and pass either `adapter` for a direct database connection or
`accelerateUrl` for Accelerate to the `PrismaClient` constructor.
```

Prisma 7 made the classic `datasource db { url = env("DATABASE_URL") }` pattern invalid; it now
requires a `prisma.config.ts` plus an explicit driver adapter (e.g. `@prisma/adapter-pg`) wired
into the `PrismaClient` constructor. That's a legitimate direction (it's how Prisma reaches
edge/serverless runtimes cleanly), but it's new surface area — an extra config file, an extra
driver dependency, and a constructor-injection step — for a project whose stated principle is
"boring, well-documented tech over novel tech" (`05-ARCHITECTURE.md` §1) running a conventional
long-lived NestJS process on Fly, not an edge function.

**2. Whether a failed startup DB connection should crash the app.** The NestJS official Prisma
recipe (and the first version of `PrismaService` written for this story) calls `this.$connect()`
in `onModuleInit` and lets it throw. That crashed `apps/api`'s own e2e test suite the moment
`PrismaModule` became a global import of `AppModule`: `test/health.e2e-spec.ts` boots the full
`AppModule` and hit `PrismaClientInitializationError: Environment variable not found:
DATABASE_URL` before ever reaching the assertion — even though `/health` itself never touches
Prisma. That's a direct regression against `health.controller.ts`'s own documented invariant
("no DB, no AI calls) so a slow downstream never flaps the health check)."

## Decision

**Pin to the latest stable Prisma 6.x (`6.19.3`) for both `prisma` (devDependency, CLI-only —
moved out of `dependencies`) and `@prisma/client` (dependency), exact versions (no `^`), instead
of adopting Prisma 7's adapter-based config.** The classic `datasource { url = env(...) }` form
stays valid and is what `apps/api/prisma/schema.prisma` uses. Revisiting Prisma 7 is left as a
deliberate future upgrade (tracked in the backlog), not something to land as a side effect of an
unpinned `npm install` grabbing whatever `latest` resolves to that day.

**Make `PrismaService.onModuleInit` fail soft:** wrap `this.$connect()` in `try`/`catch`, log the
error, and let module init resolve either way (`apps/api/src/prisma/prisma.service.ts`). This is
safe because Prisma Client connects lazily on its first real query regardless of whether
`$connect()` was called explicitly — the explicit call is purely a fail-fast/warm-pool
optimization, not a requirement. A real DB outage now surfaces as a failed query at request time
instead of blocking every route (including DB-independent ones) from ever coming up.

Verified: `apps/api/prisma/migrations/20260910194813_init` applied successfully against the real
Neon instance and a live create/read/delete round trip succeeded (see
`docs/architecture/data-model.md` and `docs/runbooks/database-migrations.md`); with the fail-soft
change, `npm run test:e2e` passes with no `DATABASE_URL` set at all (verified locally — both
`app.e2e-spec.ts` and `health.e2e-spec.ts` pass, logging a caught connection error rather than
crashing app boot).

## Consequences

- **Easier:** `apps/api/prisma/schema.prisma` stays the simple, extremely well-documented form
  most Prisma tutorials and the NestJS Prisma recipe use — no adapter package, no
  `prisma.config.ts` to keep in sync with the schema. The app (and its e2e tests) boot correctly
  regardless of DB reachability, matching the existing health-check-independence principle.
- **Harder:** we're intentionally one major version behind Prisma's `latest` tag, so `npm install`
  without an explicit version will drift us back toward 7.x/8.x — the exact pin is what prevents
  that, and whoever eventually upgrades needs to do the adapter migration deliberately (see
  https://pris.ly/d/major-version-upgrade) rather than it happening implicitly. A startup DB
  outage is now silent at the log level rather than a hard crash — acceptable for this admin/CMS
  API's blast radius, but worth reconsidering if we ever add a Kubernetes-style readiness probe
  that should reflect DB health specifically (tracked as a backlog follow-up, not done here).
- Prisma's CLI has a known high-severity transitive advisory (`deepmerge-ts` via `@prisma/config`,
  GHSA-ggr8-5vv4-36mx) at this version; it's a devDependency-only code path (`prisma` CLI, not
  `@prisma/client` used at runtime) so it doesn't ship in the production image. `npm audit fix
--force`'s suggested fix downgrades to `prisma@6.12.0`, which we're not doing since it's an
  older patch than what we pinned for other reasons above — tracked as a backlog item to revisit
  when a fixed release lands.
