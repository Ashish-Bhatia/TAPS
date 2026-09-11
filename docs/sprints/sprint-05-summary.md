# Sprint 5 — Backlog cleanup, security hardening, and closing the deploy-pipeline loop

Sprint dates: 2026-09-11 (single continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `2ade31d` (Sprint 4 close-out summary). Result: `develop`
at `229ccd9` (`TAPS-2.7` merge) as of this doc's own commit — ten feature/fix PRs merged, CI green
on every one, plus two real production deploys of `apps/api` (below). `main` has **not** been
synced this sprint (per instruction) — it remains at `e26b218` (`TAPS-1.22`'s one-time sync,
Sprint 4), five sprints' worth behind on `develop`-only work as of Sprint 4's close, now ten
stories further behind.

## Pre-flight: closing out Sprint 4's carryover

`TAPS-1.22` was filed `Ready` at Sprint 4's close (the CI-driven `apps/api` deploy pipeline that
sprint's main-sync incident showed was missing) and was built and closed immediately after, before
Sprint 5's own stories began:

| Story       | PR(s)                                                                                                                                                                                                                                                                 | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-1.22` | [#40](https://github.com/Ashish-Bhatia/TAPS/pull/40) (pipeline), [#42](https://github.com/Ashish-Bhatia/TAPS/pull/42) (one-time `main` sync), [#41](https://github.com/Ashish-Bhatia/TAPS/pull/41)/[#43](https://github.com/Ashish-Bhatia/TAPS/pull/43) (status docs) | A `workflow_run`-triggered `deploy-api.yml` that deploys `apps/api` to Fly on every successful `main` CI run, then runs a post-deploy smoke test exercising real user **and** admin auth end-to-end (`.github/scripts/smoke-test-api.sh`), not just `/health` — written specifically against Sprint 4's failure mode (a green `/health` while auth was silently broken). Verified live: `flyctl deploy` shipped a real image, the smoke test passed all three checks against the real deployed URL. See `docs/adr/017-api-ci-deploy-pipeline.md`. This pipeline, and the `release_command`/deploy path it owns, is exactly what `TAPS-2.6` and `TAPS-2.7` build on below. |

## Infra pre-flight (`TAPS-1.25`) — the real run

This section was written incrementally, mid-sprint, as `TAPS-1.25`'s own checklist was run for real
per `docs/runbooks/sprint-infra-preflight.md` (the first time that checklist has existed) — kept
here verbatim rather than summarized away, since the command-level detail is the actual evidence
`TAPS-1.25`'s "Done" status rests on:

| Check                             | Result | Notes                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` not shadowing `gh` | ❌→✅  | Found shadowing FOR REAL mid-sprint while working `TAPS-1.24`: `gh api`'s `security_and_analysis` field came back empty until `GITHUB_TOKEN`/`GH_TOKEN` were excluded from the call. Confirmed clean once excluded — `gh auth status` shows the real `gho_...` session with `repo`+`admin:repo_hook`. |
| `default_branch` is `develop`     | ✅     | `gh api repos/Ashish-Bhatia/TAPS --jq '.default_branch'` → `develop`                                                                                                                                                                                                                                  |
| `enforce_admins` true (`main`)    | ✅     | `gh api .../branches/main/protection --jq '.enforce_admins.enabled'` → `true`                                                                                                                                                                                                                         |
| `enforce_admins` true (`develop`) | ✅     | `gh api .../branches/develop/protection --jq '.enforce_admins.enabled'` → `true`                                                                                                                                                                                                                      |

The `GITHUB_TOKEN`-shadowing row is real, not hypothetical: this exact checklist would have caught
it proactively, at the start of the sprint, instead of it being discovered mid-story while trying
to read/write repo security settings for `TAPS-1.24`.

**Recorded decision, not a silent gap:** the same protection-endpoint check shows
`required_pull_request_reviews.required_approving_review_count: 0` on both `main` and `develop`.
This is deliberate for a 2-person team, not an unexamined hole — code review happens via chat
approval plus the PR description, gated by the sandbox's per-PR merge-confirmation rule (every
`gh pr merge` requires an explicit go-ahead), rather than through GitHub's numeric reviewer count.

## What shipped

| Story       | PR(s)                                                                                                                                                     | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-1.11` | [#44](https://github.com/Ashish-Bhatia/TAPS/pull/44)                                                                                                      | Re-verified against real command output rather than the prior stale status: `apps/web` test scaffolding is genuinely complete (`npm run test --workspace=web` — 21 files / 82 tests passing, wired into CI already). `apps/mobile` still has no test script or tooling at all — left honestly **Partially Done**, not rounded up, and stays out of Sprint 5 scope per this entry's own existing scope note.                                                                                                                                                                                                                             |
| `TAPS-1.17` | [#45](https://github.com/Ashish-Bhatia/TAPS/pull/45)                                                                                                      | `.prettierignore` now covers `**/next-env.d.ts` — reproduced the spurious `format:check` failure first (Prettier only reads the root `.gitignore`, not `apps/web`'s nested one), then confirmed the fix.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `TAPS-1.18` | [#46](https://github.com/Ashish-Bhatia/TAPS/pull/46)                                                                                                      | CI split into independent `api`/`web`/`mobile`/`format` jobs for clear per-app pass/fail visibility, with a `ci` aggregator job restoring the single `CI` check name `develop`'s branch protection requires (the split broke that check name on the first merge attempt — real failure, fixed in the same PR).                                                                                                                                                                                                                                                                                                                          |
| `TAPS-1.19` | [#47](https://github.com/Ashish-Bhatia/TAPS/pull/47)                                                                                                      | `apps/mobile`'s `app.json` `web` block removed (mobile is Android-first/iOS-Phase-2 per the PRD, no web target) rather than adding `react-native-web` as scope creep. Real finding: this alone doesn't fix `expo export`'s default all-platforms mode — that needed the documented `--platform android --platform ios` invocation instead. See `docs/adr/018-mobile-export-platform-scope.md`.                                                                                                                                                                                                                                          |
| `TAPS-2.10` | [#48](https://github.com/Ashish-Bhatia/TAPS/pull/48)                                                                                                      | `PrismaExceptionFilter` now maps `P2003` (FK constraint violation) to a clean `409` instead of a `500` when deleting an `ExamBoard` with attached `Syllabus`/`PastPaper` rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `TAPS-3.7`  | [#49](https://github.com/Ashish-Bhatia/TAPS/pull/49)                                                                                                      | Tag-based caching (`next.tags` + `revalidateTag`) for the nav exam-board list, board detail, and board posts, invalidated via a new authenticated `POST /api/revalidate` route that `apps/api`'s admin write endpoints call after every write (fails soft, never blocks the write). Live-verified end-to-end against a real running server and a real upstream hit-counter: 2 cached requests produced 0 new upstream hits, then a real revalidate call produced exactly 1. See `docs/adr/019-tag-based-cache-revalidation.md`.                                                                                                         |
| `TAPS-1.24` | [#50](https://github.com/Ashish-Bhatia/TAPS/pull/50) (partial + `BLOCKED` escalation), [#51](https://github.com/Ashish-Bhatia/TAPS/pull/51) (closed Done) | GitHub secret scanning/push protection: 3 of 5 `security_and_analysis` sub-features enabled and verified live in the real Settings UI (`secret_scanning`, `secret_scanning_push_protection`, `dependabot_security_updates`); push protection confirmed blocking a real fake-but-correctly-formatted GitHub PAT. The other 2 (`secret_scanning_validity_checks`, `secret_scanning_non_provider_patterns`) don't appear anywhere in this personal GitHub account's Settings page at all — a genuine, confirmed account-tier platform limitation, documented rather than left as a mystery. See `docs/runbooks/secret-scanning-status.md`. |
| `TAPS-1.25` | [#52](https://github.com/Ashish-Bhatia/TAPS/pull/52)                                                                                                      | `docs/runbooks/sprint-infra-preflight.md` — a documented pre-flight checklist for any sprint syncing to `main`, run for real (not just written): confirmed `default_branch` is `develop`, `enforce_admins.enabled` true on both `main`/`develop`, and the `GITHUB_TOKEN`-shadowing check genuinely caught the exact incident Sprint 3 hit mid-`TAPS-1.14`.                                                                                                                                                                                                                                                                              |
| `TAPS-2.6`  | [#53](https://github.com/Ashish-Bhatia/TAPS/pull/53)                                                                                                      | `apps/api/fly.toml`'s new `[deploy]` section wires `release_command = 'npx prisma migrate deploy'`, closing the "someone has to remember to migrate manually" gap from `TAPS-2.2`. See "The ADR-003 reversal" below for the dependency-classification trade-off this required, and "The two real production deploys" for how it was verified.                                                                                                                                                                                                                                                                                           |
| `TAPS-2.7`  | [#54](https://github.com/Ashish-Bhatia/TAPS/pull/54)                                                                                                      | New `GET /ready`, deliberately separate from the DB-independent `GET /health` — runs a real `SELECT 1` on every call, `200` if the database answers, `503` if it doesn't. Closes the gap `ADR-003` itself flagged (a startup DB outage fails soft, so nothing answered "is the DB reachable right now" until this). See "Real, not mocked" evidence below.                                                                                                                                                                                                                                                                              |

All ten landed with passing CI, tests, and docs updated in the same PR as the code, per
`07-DOCUMENTATION-STANDARDS.md`.

## The two real production deploys (v21, v22)

`TAPS-2.6` and `TAPS-2.7` both touch the exact `fly.toml` `release_command`/deploy path `TAPS-1.22`
built and verified against production in Sprint 4. Per this project's evidence standard (no
mocked-only coverage for a claim this central), both stories needed real evidence that the actual
release-machine mechanism works — and Fly has no staging environment for this project, so "real"
here means the one live `taps-api` app, not a separate lower environment:

- **`TAPS-2.6` (release v21):** before touching anything, confirmed all 9 existing migrations were
  already applied to the real Neon database (a safe no-op to exercise). Built the exact production
  Docker image locally and ran the exact release command against the real `DATABASE_URL`
  (`No pending migrations to apply.`), then ran a real `fly deploy --config apps/api/fly.toml
--dockerfile apps/api/Dockerfile .` against the live app. Fly's actual release machine executed
  it: `Running taps-api release_command: npx prisma migrate deploy` →
  `✔ release_command completed successfully`. `/health` returned `200` afterward.
- **`TAPS-2.7` (release v22):** verified `/ready` locally first against both a real reachable and a
  real genuinely-unreachable database (below), then deployed this exact branch to the live app to
  confirm parity with `TAPS-2.6`'s evidence depth — release v22 re-ran the same `release_command`
  successfully, and `curl https://taps-api.fly.dev/ready` returned a real `200` against the live
  Neon DB.

Both deploys happened **ahead of** the standing sprint-end-only `main`-sync process (per
`ADR-017`'s deploy pipeline being `main`-only, and the sprint-end batching convention from Sprint
4's retro) — a deliberate, scoped exception for exactly two stories whose central claim is "this
works against a real Fly release machine," the same category as Sprint 4's one-time `main` sync
(`PR #38`) and `TAPS-1.22`'s own `PR #42`. The standing process resumes immediately after: `develop`
is **not** synced to `main` this sprint (per instruction) — that remains a separate, deliberate
future action, not an implicit side effect of these two deploys.

**Real, not mocked, evidence for `TAPS-2.7` specifically** (its own claim — a DB-aware check that
actually distinguishes DB-up from DB-down): built and ran the real compiled app locally against the
real Neon `DATABASE_URL` (`/ready` → real `200`), then ran the identical build with `DATABASE_URL`
pointed at a genuinely unreachable address (`127.0.0.1:1`, nothing listening, `connect_timeout=3`)
— a real TCP connection attempt that really failed, not a stub (`/ready` → real `503`, a real
`PrismaClientInitializationError` logged) — while `/health` on that _same_ DB-down instance stayed
`200`, confirming the two endpoints are genuinely decoupled, not just decoupled on paper. Temporary
env files that briefly held the real DB credential were deleted immediately after use; test
processes were killed after each run.

## The ADR-003 reversal from `TAPS-2.6`

Confirmed directly against Fly's own docs before relying on it: `release_command` runs in a
temporary machine built from **the same image being deployed**, with full access to the app's
secrets. That means `prisma migrate deploy` needs the `prisma` CLI (plus `prisma/schema.prisma` and
`prisma/migrations/`) present in the **runtime** image, not just the build stage.

This directly reverses part of `docs/adr/003-prisma-orm-and-connection-strategy.md`'s decision to
move `prisma` out of `dependencies` into `devDependencies` specifically to keep it build-time-only.
`apps/api/package.json` now lists `prisma` as a real `dependency` again; the `Dockerfile`'s runtime
stage now also copies `apps/api/prisma`. Documented as an accepted trade-off in
`docs/adr/020-migrate-deploy-release-command.md`: this is the standard, officially-documented
Prisma-on-Fly pattern, not a novel workaround, and the exposure is limited to the CLI, exercised
only by the ephemeral release machine — never the long-lived app process handling real traffic.

**`TAPS-2.8`'s backlog entry has been updated to match reality**: it previously described the
`prisma` CLI's `deepmerge-ts` high-severity advisory (GHSA-ggr8-5vv4-36mx) as "devDependency-only
(build-time, not runtime)" — that framing is no longer true. The entry now says so directly and
notes the advisory's priority is arguably higher given the production-image exposure, though it
remains `Ready` (still no fixed upstream release to move to).

## What moved

Pre-flight: `TAPS-1.22` — **Ready → Done**. Sprint 5: `TAPS-1.11` — **Ready → Partially Done**
(re-verified honestly, not rounded up — `apps/mobile`'s gap is real and stays out of scope).
`TAPS-1.17`, `TAPS-1.18`, `TAPS-1.19`, `TAPS-2.10`, `TAPS-3.7`, `TAPS-1.24`, `TAPS-1.25`, `TAPS-2.6`,
`TAPS-2.7` — all **Ready → Done**. `TAPS-2.8` — stays `Ready`, description updated to reflect the
new production-image exposure from `TAPS-2.6`. No story was left mid-sprint or silently dropped.

## Verification

CI was green on all ten feature/fix PRs. Full test suites were re-run fresh for this summary rather
than assumed from prior PR descriptions:

- `apps/api`: `npm run test --workspace=api` — **36 test files, 152/152 passing**, no regressions.
- `apps/web`: `npm run test --workspace=web` — **22 test files, 91/91 passing**, no regressions.

Both counts match what each story's own PR reported at merge time, confirming nothing has drifted
since. The two production deploys (above) were verified against the real, live `taps-api` app
itself — release v21 and v22 both `complete` per `fly releases`, `/health` and `/ready` both
returning real `200`s afterward.

## Retro

**What changed this sprint, breaking the pattern flagged in Sprints 2–4:** the last three sprint
retros in a row named the same failure mode — an infrastructure/deploy/secrets gap discovered
_reactively_, through a live incident, rather than _proactively_, through a check run ahead of time
(Sprint 3's `GITHUB_TOKEN` shadowing; Sprint 4's main-sync deploy incident, where a green `/health`
masked completely broken admin auth in production since Sprint 1). Sprint 4's retro named the fix
directly: make a real deploy-and-smoke-test pass a standing pre-flight rather than something only
discovered when an incident forces a look.

This sprint is the first time that fix was actually applied as a working method, not just written
down as an intention. `TAPS-2.6` and `TAPS-2.7` both touch the exact deploy path a future incident
could hide in — and rather than merging on unit tests alone and finding out later (the Sprints 2–4
pattern), both were verified with real command output against the live `taps-api` app and a real
DB-down scenario _before_ merge: real `fly deploy` runs (v21, v22), a real `docker run` against the
real Neon database, and a real unreachable-database test that produced a real
`PrismaClientInitializationError`, not an asserted one. `TAPS-1.25`'s pre-flight checklist and
`TAPS-1.22`'s smoke-tested pipeline were the scaffolding; this sprint is the first evidence that
scaffolding actually changes what "Done" requires before merge, not just what gets checked after
something breaks.

**One thing to keep watching, not yet a incident:** `TAPS-2.8`'s advisory now has a materially
larger blast radius (production image, not build-time-only) as a direct consequence of `TAPS-2.6`
being the right call — an example of a deliberate, accepted trade-off surfacing from a
_proactive_ review (this sprint's own ADR process) rather than a reactive incident. That's the
target pattern going forward: trade-offs found and documented at decision time, not discovered
later.

## Sprint 6

Not yet planned. Candidate stories remain in the backlog (`docs/backlog/BACKLOG.md`) with status
`Ready`: `TAPS-1.12`/`1.13` (initialize `packages/types`/`packages/ui` as real shared workspaces),
`TAPS-2.5` (Prisma 7.x/8.x upgrade with driver adapters), `TAPS-2.8` (the `deepmerge-ts` advisory,
now higher-priority per this sprint's finding above), and `TAPS-2.12` (`multer` DoS advisories, no
fix available yet) — pending Ashish's sprint-planning approval per `04-AGILE-PROCESS.md` §3.
Whether/when to sync `develop` to `main` is a separate, explicit decision for Ashish, not bundled
into sprint planning by default.
