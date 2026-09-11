# Sprint 2 — EPIC 3: Web App Navigation, Exam Hub Pages, Search

Sprint dates: 2026-09-10 (single continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `442aea0` (Sprint 1 close-out). Result: `develop` at
`c5709f1`, four PRs merged, CI green on every one, verified again from a clean `npm ci` checkout
after the last merge.

## What shipped

| Story      | PR                                                   | Summary                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TAPS-3.1` | [#18](https://github.com/Ashish-Bhatia/TAPS/pull/18) | Public, unauthenticated read-only `ExamBoard`/`Post` endpoints under a new `PublicContentModule` (`/public/exam-boards`, `/public/posts`), structurally separate from the admin CRUD controllers so no route can accidentally gain or lose the JWT guard. Shared pagination envelope reused by `TAPS-3.4`. `docs/api/public-content.md` (new), `docs/adr/006-public-content-api-shape.md` (new). |
| `TAPS-3.2` | [#19](https://github.com/Ashish-Bhatia/TAPS/pull/19) | `apps/web` navigation shell — shared header (grouped nav links matching the source site's "Teaching Exams"/"TET Exams" dropdowns) and footer, wired into the root layout. `docs/architecture/web-app.md` (new), `docs/adr/007-nav-data-sourcing.md` (new).                                                                                                                                       |
| `TAPS-3.3` | [#20](https://github.com/Ashish-Bhatia/TAPS/pull/20) | Exam hub page template (`apps/web/src/app/exam-boards/[id]/`) rendering a board's info and published posts from `TAPS-3.1`'s public API, with a proper Next.js `not-found` page for unknown ids. Surfaced the ADR-008 caching bug (below). `docs/adr/008-web-api-fetch-caching.md` (new), addendum in `docs/adr/006-public-content-api-shape.md`.                                                |
| `TAPS-3.4` | [#21](https://github.com/Ashish-Bhatia/TAPS/pull/21) | Site search — Postgres full-text search (`tsvector`/`ts_rank`/`websearch_to_tsquery`, generated `searchVector` columns + `GIN` indexes on `ExamBoard`/`Post`) across posts and exam boards, API endpoint plus basic web UI, reusing `TAPS-3.1`'s pagination shape. `docs/adr/009-full-text-search.md` (new), `docs/api/public-content.md` updated, `docs/architecture/web-app.md` updated.       |

All four landed with passing CI, Vitest unit tests for new logic, and docs updated in the same PR
as the code per `07-DOCUMENTATION-STANDARDS.md` — none deferred to a follow-up "docs pass."

## The ADR-008 caching bug (loop-prevention rule 1 triggered)

`TAPS-3.3`'s exam hub page was the first page in `apps/web` to render data that changes through
the admin CRUD API during normal use. Its original fetch used `next: { revalidate: 300 }` (the
same Next.js ISR-style caching `TAPS-3.2` had set up for the nav's exam-board list), and publishing
a new post via the admin API never showed up on its board's hub page — the fetch consistently
returned a stale, empty result, and the staleness survived a full dev-server restart and a deleted
`.next` directory.

Two structurally different diagnostic angles were tried — reproducing outside Next's request
context via a plain `node` script (which returned correct live data every time), and confirming the
staleness wasn't tied to that process's own cache lifetime — and both pointed at Next.js 16.3.4's
own Data Cache implementation rather than this repo's code. Per `10-LOOP-PREVENTION-PROTOCOL.md`
Rule 1, a third diagnostic variation wasn't attempted; instead every `apps/web` fetch to `apps/api`
was switched to `cache: 'no-store'`, fixing the symptom directly. The accepted trade-off (every
route now server-rendered per-request instead of statically pre-rendered) and the follow-up to
investigate the actual Next.js root cause are recorded in `docs/adr/008-web-api-fetch-caching.md`
and carried into the backlog as `TAPS-3.5`.

## New backlog items filed (not folded into this sprint)

Found as direct byproducts of `TAPS-3.1`–`3.4` work, filed as separately-scoped follow-ups per
`10-LOOP-PREVENTION-PROTOCOL.md` Rule 3 (no silent scope creep) rather than fixed in-line:

- **TAPS-2.11** — Extend `TAPS-2.4`'s seed data with BPSE, UP-TGT/PGT, and REET `ExamBoard` rows —
  found during `TAPS-3.2`, since the nav's "Teaching Exams" dropdown only shows 3 of the source
  site's 6 listed boards until these exist.
- **TAPS-3.5** — Investigate the Next.js 16/Turbopack Data Cache bug behind ADR-008 and reintroduce
  caching once it's understood or fixed upstream.
- **TAPS-3.6** — Board-specific exam hub sub-pages (Syllabus/Pattern/Previous Papers/Study
  Material/Eligibility) once those models get a public API — `TAPS-3.3`'s hub page currently links
  to generic placeholders.

## What moved

All four sprint stories: **Ready → Done.** No story was left mid-sprint or silently dropped.

## Verification

CI was green on all four feature-branch PRs and on the `develop`→`main` merge that followed. A
full workspace test run after the last merge passed with no failures and no regressions in
previously-passing suites: `apps/api` 18 spec files / 52 tests passing, `apps/web` 5 test files /
16 tests passing (68/68 total). `apps/mobile` still has no test script (tracked as `TAPS-1.11`,
unrelated to this sprint's scope).

## Retro

**What went smoothly:** unlike Sprint 1, no branch was opened against a stale `develop` tip —
Sprint 1's retro action item (always `git fetch` and branch a new story off `develop`'s actual
current tip immediately before starting that story's work, not just once at sprint-planning time)
held for all four stories here, and no merge conflict recurred.

**What slowed the sprint down:** the ADR-008 caching bug (above) — a real framework-level issue,
not a process failure, but it did cost a full diagnose-and-fix cycle mid-story on `TAPS-3.3`.

## Sprint 3

Not yet planned. Candidate stories remain in the backlog (`docs/backlog/BACKLOG.md`) with status
`Ready`, including `TAPS-1.11`–`1.13`/`1.17`–`1.19`, `TAPS-2.5`–`2.12`, and `TAPS-3.5`/`3.6`,
pending Ashish's sprint-planning approval per `04-AGILE-PROCESS.md` §3.
