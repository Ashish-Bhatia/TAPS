# Runbook — Seeding the database

Covers `TAPS-2.4`. Seeds the six `ExamBoard` records the product launches with: DSSSB, KVS, NVS
(teaching exam boards) and CTET, UPTET, HTET (Teacher Eligibility Tests) — see
`docs/architecture/data-model.md`.

## Running it

From `apps/api/`, against whatever `DATABASE_URL` is in `.env` (or the real environment's env
vars):

```bash
npm run seed --workspace=apps/api
# or, from apps/api/ directly:
npx prisma db seed
```

This runs `prisma/seed.ts` (wired via the `prisma.seed` key in `apps/api/package.json`), which
`upsert`s each board keyed by `name` (unique since `TAPS-2.4` — see
`docs/architecture/data-model.md`). **Safe to run more than once**: re-running updates
`type`/`description` on existing rows rather than creating duplicates or wiping other data (e.g.
`Post`/`Syllabus` rows an admin has since created through the CRUD API).

## Content boundary

Exam board names, types, and descriptions in `apps/api/prisma/exam-boards.seed-data.ts` are
written from general public knowledge of what each organization is, in our own words — never
copied from sarkariteachers.com or any other source site, per the project's legal/content
boundary. If more seed data is added later (past papers, study material, syllabi), the same rule
applies: structural facts (subjects, years, board names) are fine to encode; source-site prose is
not.

## Extending the seed data

Seed data lives in `apps/api/prisma/exam-boards.seed-data.ts`, deliberately split out from
`seed.ts` itself so its shape is unit-testable
(`apps/api/prisma/exam-boards.seed-data.spec.ts`) without needing a database connection. Add a new
board by adding an entry to the `examBoards` array — the unique-name upsert means nothing else
needs to change.

## Note on `prisma/seed.ts` vs `apps/api/src/`

`prisma/seed.ts` and `prisma/exam-boards.seed-data.ts` run directly via Node's built-in TypeScript
support (`node prisma/seed.ts`), not compiled through `nest build` — `apps/api/tsconfig.build.json`
only includes `src/`, so this script is intentionally outside the app's normal build. This also
means its relative import uses a real `.ts` extension
(`import ... from './exam-boards.seed-data.ts'`) rather than the `.js`-extension NodeNext
convention the rest of `apps/api/src` uses (which only resolves correctly once compiled).
