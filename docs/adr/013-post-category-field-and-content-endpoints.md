# 013 — `Post.category` field, and public endpoint shapes for Syllabus/PastPaper/StudyMaterial

Status: Accepted

## Context

`TAPS-3.8` (filed during `TAPS-3.6`, see `docs/backlog/BACKLOG.md`) closes two gaps that blocked
`apps/web`'s exam hub sub-pages from having real, content-distinct data:

1. `Post` has no way to distinguish "exam pattern" content from "eligibility" content from any
   other kind of board-specific article — both currently fall under the same `PostType.ARTICLE`,
   so `TAPS-3.6`'s two built sub-pages render identical per-board data.
2. `Syllabus`, `PastPaper`, and `StudyMaterial` have Prisma models (`TAPS-2.x`) but no public,
   unauthenticated read endpoints — `docs/adr/006-public-content-api-shape.md` only covers
   `ExamBoard`/`Post`.

Two design choices here have real trade-offs.

## Decisions

**`Post.category` is a nullable, free-form `String`, not an enum.** An enum (`PostCategory`)
would give compile-time safety and a fixed, documented vocabulary, but every new category —
and the sub-page list in `TAPS-3.6`'s description already names five (syllabus, pattern,
eligibility, papers, study material), more than `PostType`'s two values — would need a schema
migration to add. A plain `String` lets an admin tag a post with a new category the moment
content needs one, with no deploy in between; the trade-off is no DB-level guarantee against
typos (`"exam-pattern"` vs `"exam_pattern"`), which is judged acceptable at this stage since the
only writer is the admin CRUD API (`TAPS-2.3`), not free-form public input. It is indexed
(`@@index([category])`) since the public `Post` endpoint filters on it, the same reasoning as the
existing `examBoardId` index.

**`Syllabus` and `PastPaper` public list endpoints filter by `examBoardId`, following the exact
`ListPostsQueryDto` pattern** (`docs/adr/006-public-content-api-shape.md`'s addendum) — both
models already carry a required `examBoardId` FK. `PastPaper` additionally accepts `subject` and
`year`, and `Syllabus` accepts `subject` — both already indexed for these filters
(`docs/adr/004-content-schema-design.md`), and both are named as natural browse filters by the
architecture doc. All three filters are optional query params, not required, matching `Post`'s
`examBoardId` — an unfiltered list is still meaningful (e.g. an admin browse-everything view),
so nothing forces a caller to scope down.

**`StudyMaterial` has no `examBoardId`** — confirmed directly against the schema
(`05-ARCHITECTURE.md` §4 and the Prisma model both key it by `subject` only, not by exam board.
Its public list endpoint therefore takes only an optional `subject` filter (already indexed),
not `examBoardId` — there is no FK to filter on, and inventing one would mean adding a field the
model doesn't have, which is out of this story's scope (`TAPS-3.8` is API-only; the underlying
`StudyMaterial` schema is unchanged).

**Single-record lookups for all three are by `id`**, not a content-specific identifier — none of
`Syllabus`/`PastPaper`/`StudyMaterial` has a `slug`-like public identifier the way `Post` does
(`docs/adr/006-public-content-api-shape.md`'s `Post`-by-slug decision), so this matches
`ExamBoard`'s by-`id` precedent instead.

**Route names are plural to match the underlying table (`@@map`) except `Syllabus`**:
`/public/past-papers` (`past_papers`), `/public/study-materials` (`study_materials`), but
`/public/syllabus` (not the awkward "syllabuses"/"syllabi") — a naming call, not a structural one.

## Consequences

- **Easier:** `apps/web`'s remaining `TAPS-3.6` sub-pages (`/exam-boards/[id]/syllabus`,
  `/previous-papers`, `/study-material`) can now be built against real data instead of the generic
  `TAPS-3.2` placeholders; `/exam-pattern` and `/eligibility` can filter `Post` by `category`
  instead of both showing the same `ARTICLE` list. None of that `apps/web` work is done by this
  story — it is API-only, `apps/web` work resumes under `TAPS-3.6`.
- **Harder:** `Post.category` has no DB-level enum guarantee, so a typo'd category value is a
  silent content bug (a post simply won't show up under the sub-page that filters for the intended
  spelling) rather than a rejected write — acceptable today given the single trusted writer, worth
  revisiting if category values are ever exposed to less-trusted input.
