# 004 — Content schema: id strategy, indexing, and delete behavior

Status: Accepted

## Context

TAPS-2.1 translates `05-ARCHITECTURE.md` §4's field list for `ExamBoard`, `Post`, `Syllabus`,
`PastPaper`, `StudyMaterial`, and `Book` into a real Prisma schema
(`apps/api/prisma/schema.prisma`). The architecture doc gives field names and rough types but not
primary-key strategy, index design, or what should happen to child rows when an `ExamBoard` is
deleted — three choices with real trade-offs, so they get an ADR rather than a silent pick.

## Decisions

**Primary keys: `String @id @default(cuid())` on every model**, not an auto-incrementing integer
or `uuid()`. A `cuid()` is globally unique without DB coordination (so it can be generated
client-side before an insert if ever needed) and, unlike a sequential integer id, doesn't leak
how many rows exist or let a client enumerate `/posts/1`, `/posts/2`, ... on what's a public
content API. It's shorter than a `uuid()` and is Prisma's traditional built-in default, so no
extra dependency.

**Indexes: single-column indexes on exactly the fields the story named as commonly-queried**
(`examBoardId`, `subject`, `year`, `slug`), on every model that has them, plus one composite index
— `PastPaper(examBoardId, subject, year)` — for the natural admin/browse query (a board's papers
filtered by subject and year together). Note that Prisma's default `relationMode = "foreignKeys"`
does **not** auto-index foreign-key columns the way primary keys are auto-indexed, so the
`examBoardId` indexes on `Post`/`Syllabus`/`PastPaper` are load-bearing, not redundant. We
deliberately stopped at one composite index rather than adding more speculative ones (e.g.
`Syllabus(examBoardId, subject)`) — every index has a write-cost trade-off, and the story's
explicit field list plus the one obvious multi-filter browse pattern is enough real information to
index against; more can be added once real query patterns from `apps/web` exist.

**`onDelete` behavior differs by whether the FK is optional:** `Post.examBoardId` is optional per
§4 (`examBoardId?`), so deleting an `ExamBoard` sets it to `SetNull` — a post that isn't
board-specific content shouldn't disappear because a board record was removed. `Syllabus` and
`PastPaper` require an `examBoardId`, so their relation uses `Restrict` — deleting an `ExamBoard`
that still has syllabuses/papers attached fails loudly instead of silently cascading, since a CMS
admin accidentally deleting an exam board should not be able to take a term's worth of past papers
with it in the same click. `StudyMaterial` and `Book` have no `examBoardId` per §4 (subject-only),
so this doesn't apply to them.

**Table names are mapped to `snake_case`** (`@@map("exam_boards")`, etc.) rather than Prisma's
default of reusing the PascalCase model name as the literal table name — idiomatic for raw SQL/
`psql` access to the underlying Postgres tables, which the model names alone wouldn't be.

**`createdAt`/`updatedAt` timestamps were added to every model**, beyond what §4 literally lists
(only `Post.updatedAt` is named there). This is additive audit metadata, not a different business
field, and every model needing it for consistent ordering/debugging is normal practice — not
worth omitting from five of six models just because §4 only wrote it out for one.

## Consequences

- **Easier:** id values are safe to expose in public URLs (`/posts/<slug>` for content is used
  instead anyway, but past-paper/study-material ids are also fine to expose); deleting an exam
  board can't silently destroy attached syllabuses or past papers; every model has consistent
  audit timestamps without special-casing.
- **Harder:** `cuid()` ids are longer than an auto-increment integer in a URL or a `WHERE id = ?`
  clause, though this is a standard, well-understood trade-off. An admin who wants to delete an
  `ExamBoard` with existing syllabuses/papers must reassign or delete those first — intentional
  friction, not a bug, per the `Restrict` decision above.
