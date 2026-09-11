# 020 — Automated migrations via fly.toml's release_command

Status: Accepted

## Context

`TAPS-2.6`: since `TAPS-2.2`, applying a schema migration to the real Neon database has been a
manual step (`docs/runbooks/database-migrations.md`) — someone runs `prisma migrate deploy` by
hand after a deploy. Nothing forces this to happen, or to happen before the newly deployed code
(which may assume the new schema) starts serving traffic — the same "manual step nobody remembers"
shape of gap `TAPS-1.22` closed for the deploy itself.

Fly.io supports a `release_command` (`[deploy]` section of `fly.toml`) that runs once, in a
temporary machine, before the new version's machines start taking traffic; a non-zero exit aborts
the deploy. Confirmed directly against Fly's own docs before relying on it: the release machine
runs **the same image being deployed** (not a separate build target), and has full access to the
app's secrets/env vars, including `DATABASE_URL`.

That mechanical fact drives the one real trade-off here.

## Decision: ship the `prisma` CLI to the production image

`prisma migrate deploy` needs the full `prisma` CLI (not just the `@prisma/client` runtime
already shipped), plus `prisma/schema.prisma` and the `prisma/migrations/` directory. Since the
release machine uses the same image as the running app, all three now have to be present in the
runtime image, not just the build stage.

This directly reverses part of `docs/adr/003-prisma-orm-and-connection-strategy.md`'s decision to
move `prisma` out of `dependencies` into `devDependencies` specifically so it would stay
build-time-only and never reach the production image. `apps/api/package.json` now lists `prisma`
as a regular `dependency` again; `apps/api/Dockerfile`'s runtime stage now also copies
`apps/api/prisma` (schema + migrations, no engine binaries — those already flow through
`node_modules/.prisma`).

**Consequence, accepted:** the `prisma` CLI's known high-severity transitive advisory
(`deepmerge-ts`, GHSA-ggr8-5vv4-36mx, via `@prisma/config`) now reaches the production image,
where it previously didn't (`TAPS-2.8`, whose description has been updated to reflect this —
it's no longer a devDependency-only, build-time-only code path). This is the standard,
officially-documented pattern for Prisma-on-Fly (`prisma migrate deploy` in `release_command`),
not a novel workaround — and the affected code path is the CLI, exercised only by the ephemeral
release machine, never by the long-lived app process handling real traffic. Revisiting is tied to
`TAPS-2.5`/`TAPS-2.8` (a fixed release, or the Prisma 7 adapter-based config that drops the classic
CLI's dependency tree) rather than solved here.

**Alternatives considered and rejected:**

- **A separate, custom migration runner** (hand-rolled SQL applier reading `prisma/migrations/`
  directly, avoiding the `prisma` CLI dependency entirely). Rejected: reinvents
  `prisma migrate deploy`'s tracking/locking logic for a project whose stated principle is boring,
  well-documented tech over novel tech (`05-ARCHITECTURE.md` §1) — the risk of a subtly wrong
  reimplementation outweighs the advisory's actual blast radius (devDependency-adjacent CLI code,
  not a runtime request path).
- **A Fly "release" app/image separate from the deployed app.** Fly's `release_command` has no
  config surface for a different image or build target than the one being deployed (confirmed
  against the docs above) — this would require a second Fly app and its own deploy step, real
  operational complexity for a zero-budget, pre-launch project, to avoid a single devDependency
  from an ephemeral machine.

## Verification — real, not mocked

Per this project's evidence standard (`TAPS-1.22`'s smoke test, `TAPS-3.7`'s cache mechanism), the
config was verified against real infrastructure, not just a unit test asserting the string is
present (that test exists too — `apps/api/deploy-config.spec.ts` — but only as a config-drift
guard, not as the evidence this claim rests on):

1. **Confirmed all 9 existing migrations are already applied to the real Neon database** (queried
   `_prisma_migrations` directly) before touching anything — so exercising `migrate deploy` for
   real carries no risk of an untested schema change landing.
2. **Built the actual production image** (`docker build -f apps/api/Dockerfile .` from the repo
   root, the same command CI/Fly use) with the `TAPS-2.6` changes, then ran
   `docker run --env-file apps/api/.env --entrypoint npx <image> prisma migrate deploy` — i.e. the
   exact command `release_command` will invoke, in the exact image Fly will deploy, against the
   real production `DATABASE_URL`. Output: `Prisma schema loaded from prisma/schema.prisma`,
   connected to the real Neon `neondb` instance, `9 migrations found in prisma/migrations`,
   `No pending migrations to apply.` — a genuine successful run against production, not a stub.
3. **A real `fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile .`** against
   the live `taps-api` app, to confirm Fly's actual release machine (not just a local
   `docker run` standing in for it) executes the `release_command` and passes secrets/env
   correctly. See the PR/status update for that run's output.

## Consequences

- Migrations now apply automatically on every deploy that reaches the release step — no human has
  to remember to run `prisma migrate deploy` by hand. `docs/runbooks/database-migrations.md`
  updated to describe this as the new default path, manual `migrate deploy` kept only as a
  break-glass fallback.
- A broken migration now blocks the deploy outright (Fly aborts on a non-zero `release_command`
  exit) rather than shipping code that expects a schema change that never landed.
- The production image is slightly larger and carries the `prisma` CLI's dependency tree
  (including the known advisory above) that it previously didn't — an accepted, documented
  trade-off, not an oversight.
