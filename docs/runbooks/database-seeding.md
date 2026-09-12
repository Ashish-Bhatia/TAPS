# Runbook — Seeding the database

Covers `TAPS-2.4`, `TAPS-2.11`, and `TAPS-2.15` (see "Seeding Syllabus content" below). Seeds nine
`ExamBoard` records: DSSSB, KVS, NVS, BPSE,
UP-TGT/PGT, REET (teaching exam boards, shown in the "Teaching Exams" nav dropdown) and CTET,
UPTET, HTET (Teacher Eligibility Tests, shown in the "TET-Exams" nav dropdown) — see
`docs/architecture/data-model.md` and `docs/adr/007-nav-data-sourcing.md`. BPSE/UP-TGT/PGT/REET
were added in `TAPS-2.11` to close the gap ADR-007 flagged: the source site's "Teaching Exams"
dropdown lists six boards, but `TAPS-2.4` only seeded three of them.

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
convention the rest of `apps/api/src` uses (which only resolves correctly once compiled). If your
local Node is older than ~22.6 (no built-in `.ts` support — confirmed against Node 20.19.2 while
building `TAPS-2.15`, which throws `ERR_UNKNOWN_FILE_EXTENSION`), run these scripts via
`npx tsx prisma/seed.ts` instead; CI/production run a newer Node where the bare `node` invocation
works as documented.

## Seeding Syllabus content (`TAPS-2.15`)

```bash
npm run seed --workspace=apps/api             # ExamBoard rows first — Syllabus needs their ids
npm run seed:syllabus --workspace=apps/api    # then Syllabus rows
# or, from apps/api/ directly:
npx prisma db seed && node prisma/seed-syllabus.ts
```

`prisma/seed-syllabus.ts` reads `prisma/syllabus.seed-data.ts` (an array of
`{ examBoardName, subject, topics }`, unit-tested by `syllabus.seed-data.spec.ts` the same way
`exam-boards.seed-data.ts` is) and `upsert`s each into `Syllabus`, keyed by the
`@@unique([examBoardId, subject])` constraint added alongside this story. **Safe to run more than
once** — re-running updates `topics` on existing (board, subject) rows rather than creating
duplicates. It looks up each `examBoardName` against the already-seeded `ExamBoard` table and
throws if one isn't found (a real bug — a name mismatch between the two seed-data files — rather
than something to silently skip), so always run the `ExamBoard` seed first on a fresh database.

Only 4 of the 9 seeded `ExamBoard`s have a `Syllabus` entry in `syllabus.seed-data.ts` today (CTET,
HTET, REET, DSSSB) — see that file's own header comment and `TAPS-2.15`'s backlog row for exactly
what official source each came from, and what was tried and abandoned for the other 5 (UPTET, KVS,
NVS, BPSE, UP-TGT/PGT). Extending coverage to one of those boards, or adding more subjects for a
board already covered, means finding that board's own official notification/information-bulletin
PDF (never an aggregator) and adding an entry to the `syllabuses` array — the same content-boundary
rule below applies.
