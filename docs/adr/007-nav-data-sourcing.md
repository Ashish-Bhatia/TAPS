# 007 — Navigation data sourcing: static structure, live exam-board dropdowns

Status: Accepted

## Context

`TAPS-3.2` builds the primary nav (`docs/project-knowledge/03-SOURCE-SITE-CONTENT-INVENTORY.md`'s
"Primary Navigation" list: Home, Teaching Exams, TET-Exams, Syllabus, Previous Years Papers, Study
Materials, New Jobs, NCERT Books). The backlog's own doc-impact note flagged "how nav data is
sourced — static config vs API-driven" as a real trade-off worth an ADR.

The source site's "Teaching Exams" dropdown lists six boards (DSSSB, KVS, NVS, BPSE, UP-TGT/PGT,
REET); TAPS's `TAPS-2.4` seed data only covers three of those (DSSSB, KVS, NVS) plus the three TET
boards (CTET, UPTET, HTET) — BPSE/UP-TGT-PGT/REET have no `ExamBoard` row in the database at all
yet. A purely static nav config listing all six "Teaching Exams" names would need to hardcode
`ExamBoard.id` values to link anywhere — but those are database-generated `cuid()`s
(`docs/adr/004-content-schema-design.md`), different in every environment (a fresh local dev
database seeds different ids than production Neon). Hardcoding production ids into `apps/web`'s
source would silently break local development, and static entries for the three boards with no DB
row at all would be dead links regardless of id scheme.

## Decision

**Split by section.** The nav's top-level _structure_ — which categories exist, their order and
labels — is a static config (`apps/web/src/lib/nav-config.ts`), since it mirrors a curated site
information architecture, not "whatever's currently in a database table." The **contents of the
Teaching Exams and TET-Exams dropdowns specifically** are fetched live from `TAPS-3.1`'s public API
(`getExamBoardsForNav()` in `apps/web/src/lib/api.ts`, called once in the root layout so every page
has it) and grouped by `ExamBoard.type`. This solves both problems: dropdown links always point at
real, environment-correct ids, and only exam boards that actually have content ever appear —
BPSE/UP-TGT-PGT/REET simply don't show up yet, rather than linking to nothing.

Every other nav category (Syllabus, Previous Years Papers, Study Materials, New Jobs, NCERT Books)
has no public API this sprint — only `ExamBoard`/`Post` do (`TAPS-3.1`) — so those stay static
links to placeholder pages (a `ComingSoon` component) rather than either a live fetch against an
API that doesn't exist, or a broken link. Same logic for the footer's legal links (About/Contact/
Disclaimer/Privacy): present and routable, placeholder content, per the PRD's MVP static-pages
scope.

The exam-board fetch fails soft: an API outage returns an empty list rather than throwing, so a
downstream problem in `apps/api` degrades the nav (empty dropdowns) rather than taking down every
page in `apps/web` — the same principle `docs/adr/003-prisma-orm-and-connection-strategy.md`
established for `PrismaService`, applied here at the frontend boundary. Verified: `next build`
succeeds and every route still statically generates even with no API server reachable at build
time (the expected state in CI, which doesn't run `apps/api` alongside `apps/web`'s build);
manually verified against a live local `apps/api` that all six seeded boards render correctly
split across both dropdowns.

## Consequences

- **Easier:** dropdown links are always correct for whatever database the running environment
  actually points at; no fake/dead links for exam boards that don't exist yet; a `apps/api` outage
  degrades gracefully instead of breaking every page.
- **Harder:** the "Teaching Exams" dropdown doesn't yet show full structural parity with the
  source site (only 3 of 6 boards) — that's a genuine content gap, not a code gap. Tracked as a
  new backlog follow-up: extend `TAPS-2.4`'s seed data with BPSE/UP-TGT-PGT/REET once someone
  writes their (original, non-source-site-copied) descriptions.
