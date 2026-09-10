# Runbook — Prisma migrations against Neon

Covers `TAPS-2.2`. `apps/api` uses Prisma (see `docs/architecture/data-model.md` for the schema
and `docs/adr/003-prisma-orm-and-connection-strategy.md` for the version/connection decisions).
This is the manual process for applying schema changes to the real Neon database — there is no
automated migrate-on-deploy step yet (see "Not yet automated" below).

## Prerequisites

- `apps/api/.env` (gitignored, never committed) with the real Neon `DATABASE_URL`. Copy the shape
  from `apps/api/.env.example`; get the real value from Fly secrets or the Neon console — never
  paste it into a commit, a PR description, or chat history.
- Run all commands from `apps/api/`.

## Writing and applying a new migration (local/dev flow)

```bash
cd apps/api
npx prisma migrate dev --name <short-description>
```

This diffs `prisma/schema.prisma` against the migration history, writes a new
`prisma/migrations/<timestamp>_<name>/migration.sql`, and applies it to whatever `DATABASE_URL`
points at. Commit the generated `migration.sql` — migrations are code, not generated artifacts to
gitignore.

**`migrate dev` refuses to run at all in a non-interactive shell** (e.g. this agent's sandbox),
even with `--create-only`: `Error: Prisma Migrate has detected that the environment is
non-interactive, which is not supported.` When that happens (confirmed while adding
`TAPS-2.4`'s `ExamBoard.name` unique constraint), generate the SQL by hand instead:

```bash
cd apps/api
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
# then create prisma/migrations/<timestamp>_<name>/migration.sql with that output yourself,
# and apply it with `prisma migrate deploy` (below) — which is non-interactive-safe.
```

## Applying existing migrations to Neon (what actually ran for the first migration)

```bash
cd apps/api
npx prisma migrate deploy   # applies any pending migrations, no schema diffing/prompting
npx prisma generate         # regenerates the client from the current schema
```

`migrate deploy` (rather than `migrate dev`) is the right command against a real/shared database:
it only applies migrations already committed to `prisma/migrations/`, never generates new ones or
prompts interactively — safe to run unattended.

## Confirming connectivity (don't just trust a clean migration output)

A migration completing without error proves the schema changed; it doesn't prove the app can
actually read/write through `PrismaClient`. Verify with a real query, e.g.:

```bash
cd apps/api
node -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  console.log(await prisma.examBoard.count());
  await prisma.\$disconnect();
});
"
```

This is exactly what was run to verify `TAPS-2.2`: the first migration
(`prisma/migrations/20260910194813_init`) was applied to the real Neon instance, then a live
create → read → delete round trip against the `exam_boards` table succeeded and the temporary row
was cleaned up (no residue left in the database from the verification).

## Not yet automated

Migrations are **not** run automatically on `fly deploy` — there is no `release_command` in
`apps/api/fly.toml` wired to `prisma migrate deploy`. For this sprint's scope, that's a deliberate
manual step (this runbook), not an oversight; automating it is tracked as a follow-up backlog item
rather than bundled into this story (see `docs/backlog/BACKLOG.md`), since it's a separate
decision (what should happen if a migration fails mid-deploy, whether it blocks traffic cutover,
etc.) that deserves its own scoped story rather than a silent addition here.
