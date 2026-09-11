# Sprint 4 — EPIC 3 close-out + EPIC 5: User Accounts & Progress Dashboard

Sprint dates: 2026-09-11 (single continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `cb6bc17` (Sprint 3 close-out). Result: `develop` at
`38f8319` — eight feature/docs PRs merged, CI green on every one — plus a one-time sync of `main`
up to that tip (`main` now at `77369a2`; see "The main-sync deploy incident" below, the sprint's
major unplanned finding).

## Pre-flight: closing out Sprint 3's carryover

Three items left `Ready` at Sprint 3's close were finished before EPIC 5 planning:

| Story      | PR                                                                                                         | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-3.5` | [#30](https://github.com/Ashish-Bhatia/TAPS/pull/30)                                                       | Next.js Data Cache audit — every `apps/web`→`apps/api` fetch (both call sites) checked against Next.js 16.3.4's real current caching defaults (read from the installed docs, not assumed). Finding: `cache: 'no-store'` (ADR-008's fix) is still correct and already safe for EPIC 5's upcoming user-specific fetches; no code changes needed. Root-cause investigation of the underlying Next.js bug itself was retired per loop-prevention Rule 1. One real follow-up filed as `TAPS-3.7` (static-content revalidation), not built here.                                                                                                                                                                        |
| `TAPS-3.8` | [#32](https://github.com/Ashish-Bhatia/TAPS/pull/32)                                                       | Public read-only endpoints for `Syllabus`/`PastPaper`/`StudyMaterial` plus a `Post.category` field — both found blocking `TAPS-3.6`. While applying the migration, surfaced and fixed a genuine pre-existing issue: a stale failed-migration row in `_prisma_migrations` (residue from `TAPS-4.0`) permanently blocks `migrate dev` on this database, even after `migrate resolve --rolled-back`. Worked around with the hand-write-SQL + `migrate deploy` path, and the addendum recording this in `docs/runbooks/database-migrations.md` is what let `TAPS-5.1`'s later occurrence of the exact same block be resolved without re-diagnosis. `docs/adr/013-post-category-field-and-content-endpoints.md` (new). |
| `TAPS-3.6` | [#31](https://github.com/Ashish-Bhatia/TAPS/pull/31), [#33](https://github.com/Ashish-Bhatia/TAPS/pull/33) | Board-specific exam hub sub-pages, shipped in two parts because `TAPS-3.8`'s API was itself a mid-story blocker: PR #31 delivered the 2 of 5 sub-pages real data already supported (exam-pattern, eligibility) against the existing `Post`/`PostType` shape; PR #33 resumed once `TAPS-3.8` merged and delivered the remaining 3 (syllabus, previous-papers, study-materials) on a new `ExamBoardRecordsPage` component, plus switched the first two to real `Post.category` filtering. All 5 sub-pages are now real, board-specific routes.                                                                                                                                                                      |

All three landed with passing CI, tests, and docs updated in the same PR as the code per
`07-DOCUMENTATION-STANDARDS.md`.

## What shipped — EPIC 5: User Accounts & Progress Dashboard

| Story        | PR                                                                                                         | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-5.1`   | [#34](https://github.com/Ashish-Bhatia/TAPS/pull/34)                                                       | `User` model + a fully separate `apps/api/src/user-auth/` module — own `UserJwtAuthGuard`, own `USER_JWT_SECRET`, own `{ userId, email }` claim shape, sharing nothing at runtime with the admin CMS's `AuthService`/`JwtAuthGuard`/`JWT_SECRET`/`{ sub, role }` beyond the bcrypt salt-round count. Full blast-radius reasoning in `docs/adr/014-user-auth-separate-from-admin-auth.md`. Live-smoke-tested end-to-end (register/duplicate/login/wrong-password/nonexistent-email, JWT payload decoded and confirmed).                                                                                                                |
| `TAPS-5.2`   | [#35](https://github.com/Ashish-Bhatia/TAPS/pull/35)                                                       | `QuizAttempt` model + `apps/api/src/quiz-attempt/`: `POST /quiz-attempts/start` (selects up to 10 questions for an exam board, strips answers) and `POST /quiz-attempts/:id/submit` (ownership-checked, scores, computes a per-topic `weakTopics` tally). No separate `Quiz`/`QuizSession` model — see `docs/adr/015-quiz-attempt-data-shape.md`. Live-smoke-tested (403 on someone else's attempt, 409 on a double submit, correct scoring/weak-topic tally on a known answer set).                                                                                                                                                  |
| `TAPS-5.3`   | [#36](https://github.com/Ashish-Bhatia/TAPS/pull/36), [#37](https://github.com/Ashish-Bhatia/TAPS/pull/37) | Progress dashboard, shipped in two parts. The `apps/api` half (`GET /quiz-attempts/me` — attempts, an accuracy trend, and a merged weak-topic heatmap) landed immediately in PR #36. The `apps/web` half then sat **Blocked**, not because of missing API surface but because of a real sprint-planning gap: no login UI or session mechanism existed anywhere in `apps/web` yet, so a dashboard gated on "the user being logged in" had nothing to gate against. That gap was filed as `TAPS-5.0.5` and built first; the dashboard page shipped alongside it in PR #37 once unblocked.                                               |
| `TAPS-5.0.5` | [#37](https://github.com/Ashish-Bhatia/TAPS/pull/37)                                                       | `apps/web` login/session handling — the prerequisite `TAPS-5.3` surfaced. `apps/api` needed zero code changes (its existing `{ accessToken }` response already fit). `apps/web` gained `/login`/`/register` pages posting to new Route Handlers that call `apps/api` server-to-server and set the JWT as an httpOnly cookie **on `apps/web`'s own domain** — the fix for `apps/api` (Fly.io) and `apps/web` (Vercel) being different domains, since a cookie `apps/api` set itself would never reach `apps/web`'s own server-side requests. Full design and the alternatives rejected: `docs/adr/016-web-session-cookie-strategy.md`. |

All four landed with passing CI, unit tests for new logic, and docs updated in the same PR as the
code. `TAPS-5.1`'s PR also carries a real incident note (below).

## The `TAPS-5.1` credential-exposure near-miss

While generating `TAPS-5.1`'s migration diff, a shell quoting mistake (`source .env` on a file
whose `DATABASE_URL` contains an unescaped `&` in its query string) caused a bash job-control
message containing a fragment of the real Neon database password to appear in the session
transcript. The mistake was caught immediately — the command was corrected on the spot to
`--from-schema-datasource`, which lets Prisma read the `.env` file itself without the secret ever
passing through shell string interpolation — and no further exposure occurred. The Neon database
credential was rotated afterward out of caution regardless. This is now saved as a standing lesson
(`bash-env-var-quoting-safety` in Claude Code's memory): never `source`/`export` a `.env` file into
a shell variable to hand a secret to a subprocess; let the tool load its own env file, or use a
flag that avoids shell interpolation entirely.

## The main-sync deploy incident (this sprint's major unplanned finding)

`main` had not been synced with `develop` since Sprint 3's close (`cb6bc17`) — five sprints' worth
of `develop`-only work (`TAPS-3.5`/`3.6`/`3.8`, all of EPIC 4, all of EPIC 5) had never reached
production. `PR #38` did a **deliberate, one-time exception** to the standing sprint-end-only batch
process, syncing `main` up to `develop`'s tip mid-sprint specifically because further web-session
work needed production to actually reflect what `develop` already had — the PR's own description
states plainly that the standing process resumes right after. That sync is what surfaced everything
below; none of it would have been found by anything this sprint's stories were actually testing for.

**Finding 1 — `apps/api` has no CI/CD deploy pipeline at all.** `.github/workflows/ci.yml` runs
lint/test on every push to `main` and every PR; nothing in it (or anywhere else in the repo) runs
`fly deploy`. Unlike `apps/web` on Vercel — which redeploys automatically on every push to `main`,
per `docs/runbooks/deploy-api.md`'s CORS section — `apps/api` on Fly.io has never auto-deployed on
a merge. Every prior "Done" story that touched `apps/api` was verified against a local server or
the shared dev database, never against what was actually running at `taps-api.fly.dev`.

**Finding 2 — the first manual `fly deploy` failed on a build-context mismatch.** `apps/api`'s
`Dockerfile` needs the repo root as its build context (single root lockfile, npm workspaces), even
though `fly.toml` lives in `apps/api/` — documented already in both `fly.toml`'s own header comment
and `docs/runbooks/deploy-api.md`, but not followed on the first attempt. Fixed by running from the
repo root with the documented explicit flags: `fly deploy --config apps/api/fly.toml --dockerfile
apps/api/Dockerfile .`.

**Finding 3 — after a successful deploy, user registration 500'd in production.** `USER_JWT_SECRET`
— the secret `TAPS-5.1` introduced for the separate user-auth JWT signing key — had only ever been
_documented_ in `apps/api/.env.example`; it had never actually been set on the real Fly app,
confirmed directly via `fly secrets list`. Worse, this silently created an **orphaned `User` row**
in the production database: `UserAuthService.register`'s database write completes and commits
before the JWT-signing step that then crashed on the missing secret, so a real user row with no
corresponding successful response existed with no one aware of it. It was found and manually
deleted.

**Finding 4 — checking the admin secret for the same gap found a second, larger one.** Fixing
`USER_JWT_SECRET` prompted checking whether the original admin-auth secret (`JWT_SECRET`, from
`TAPS-2.3`, Sprint 1) had the same problem. It did — and so did `ADMIN_PASSWORD_HASH`, its sibling.
Both were set. But once set, the deployed `ADMIN_PASSWORD_HASH` turned out to be an unknown,
forgotten placeholder value from `TAPS-2.3`'s original implementation, with no known matching
plaintext password anywhere. **Conclusion: admin authentication has apparently never been
functional in this production deployment since `TAPS-2.3` shipped in Sprint 1** — every "Done"
admin-CRUD story since then was verified locally or against the dev database; nobody could ever
have actually logged in to the deployed admin CMS. A fresh password was deliberately generated,
hashed, and deployed via `fly secrets set`, then verified end-to-end against the real production
app — a real `200` response with a valid JWT — the **first working admin login this production
environment has ever had**. The new password has been saved securely by the founder outside of
chat/session history, not recorded in this repo.

## New backlog items filed directly from this

- **`TAPS-1.22`** (new, `Ready`) — automate `apps/api`'s deploy via CI on merge to `main`, with
  correct build-context handling baked in (not left to a human to remember the two flags), and
  **must** include a post-deploy smoke test that exercises both user _and_ admin auth end-to-end —
  not just `/health`. `/health` passing gave false confidence the service was fully functional
  while admin auth was completely broken underneath it the entire time; a pipeline that only checks
  `/health` would ship this exact failure mode again without anyone noticing.
- **`TAPS-1.23`** (new, closed **Done** this session) — verify `JWT_SECRET`/`ADMIN_PASSWORD_HASH`
  are actually deployed and working on the real Fly app, not just documented. Both were found
  missing (Findings 3–4 above), fixed, and verified live.

## What moved

Pre-flight: `TAPS-3.5`, `TAPS-3.6`, `TAPS-3.8` — all **Ready → Done**. EPIC 5: `TAPS-5.1`,
`TAPS-5.2`, `TAPS-5.3`, `TAPS-5.0.5` — all **Ready → Done** (`TAPS-5.3` passed through a real
**Blocked** state mid-sprint, resolved once `TAPS-5.0.5` shipped). `TAPS-1.22` — **(not
planned) → Ready**. `TAPS-1.23` — **(not planned) → Done**, opened and closed in the same session.
No story was left mid-sprint or silently dropped.

## Verification

CI was green on all eight feature/docs PRs and on the `develop`→`main` sync that followed. Full
test suites were re-run fresh for this summary rather than assumed from prior PR descriptions:

- `apps/api`: `npx vitest run` — **33 test files, 137/137 passing**, no regressions.
- `apps/web`: `npx vitest run` — **21 test files, 82/82 passing**, no regressions.

Both counts match what each story's own PR reported at merge time, confirming nothing has drifted
since. All Sprint 4 migrations (`User`, `QuizAttempt`, `Post.category`) were applied and verified
against the real Neon database (`prisma migrate status`: up to date) — not just a clean local exit
code. The main-sync deploy incident (above) was verified live against the real production `apps/api`
Fly app itself, the first time any story this quarter has been checked against what is actually
running there rather than a local server or the shared dev database.

## Retro

**What slowed the sprint down, and the theme running through it:** this is now the **third sprint
in a row** where the standing pattern is an infrastructure/deploy/secrets gap discovered
_reactively_, through a live incident, rather than _proactively_, through a check run ahead of time.
Sprint 3's `TAPS-1.14` was Codespaces' `GITHUB_TOKEN` silently shadowing the real `gh` session,
masking a genuine branch-protection/default-branch misconfiguration that had been sitting unnoticed.
This sprint's main-sync incident is the same shape at a larger scale: a `/health` check that has
been green throughout gave false confidence that `apps/api` was fully functional, when in fact user
registration was broken by a missing secret and admin authentication had been completely
non-functional in production since Sprint 1 — and nothing about the deploy process would ever have
surfaced this without the one-time sync forcing a real look.

**One process change to consider next sprint** (per `04-AGILE-PROCESS.md` §3's retro process): make
a real deploy-and-smoke-test pass — not just `/health` — a standing pre-flight for **any** sprint
that will sync to `main`, given this exact failure mode (a shallow health check passing while a
core capability underneath it is silently broken) has now repeated three times. `TAPS-1.22`'s
acceptance criteria are written with this directly in mind: a CI-driven deploy pipeline whose smoke
test exercises both user and admin auth, not just liveness.

## Sprint 5

Not yet planned. Candidate stories remain in the backlog (`docs/backlog/BACKLOG.md`) with status
`Ready`, including `TAPS-1.11`, `TAPS-1.17`–`1.19`, `TAPS-1.22` (new this sprint), `TAPS-2.5`–`2.10`,
`TAPS-2.12`, and `TAPS-3.7`, pending Ashish's sprint-planning approval per `04-AGILE-PROCESS.md` §3
— including, per the retro above, whether a deploy-and-smoke-test pre-flight becomes standing
process for any sprint that syncs to `main`.
