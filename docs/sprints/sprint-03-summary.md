# Sprint 3 — EPIC 4: AI Quiz Engine

Sprint dates: 2026-09-11 (single continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `430e48d` (post-Sprint-2 audit cleanup, see
`docs/audits/audit-2026-09-11.md`). Result: `develop` and `main` both at `cb6bc17`, five PRs merged,
CI green on every one, verified again after the last merge.

## What shipped

| Story       | PR                                                       | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-2.11` | [#24](https://github.com/Ashish-Bhatia/TAPS/pull/24)     | Extended `TAPS-2.4`'s seed data with the three remaining launch exam boards (BPSE, UP-TGT/PGT, REET) — 9 `ExamBoard` rows now live in Neon (6 TEACHING, 3 TET), closing the gap `TAPS-3.2`'s nav dropdown had left. `docs/runbooks/database-seeding.md` updated.                                                                                                                                                                                                                             |
| `TAPS-4.0`  | [#26](https://github.com/Ashish-Bhatia/TAPS/pull/26)     | `PastPaper` text-extraction pipeline — admin CRUD (`TAPS-2.3`'s pattern) plus a `PastPaperIngestionService` that downloads a `PastPaper.fileUrl`'s PDF and extracts text on create, writing `extractionStatus`/`extractedText`. Surfaced and worked around a real `pdf-parse` v1 bug (below). `docs/adr/010-pdf-text-extraction.md` (new), `docs/api/past-papers.md` (new), `docs/architecture/data-model.md` updated.                                                                       |
| `TAPS-4.1`  | via [#27](https://github.com/Ashish-Bhatia/TAPS/pull/27) | `QuizQuestion` model + `AIService.generateQuizFromPaper(pastPaperId)` — calls Claude to extract question/answer pairs from a `PastPaper`'s `extractedText`, validates the JSON (retry once, then fail loudly), and persists the question bank via a new admin `POST /past-papers/:id/generate-quiz` endpoint. Delivered end-to-end through `TAPS-4.2`'s fallback path once the Anthropic-primary path hit a real billing wall mid-story (below). `docs/adr/011-ai-quiz-generation.md` (new). |
| `TAPS-4.2`  | [#27](https://github.com/Ashish-Bhatia/TAPS/pull/27)     | AI provider fallback — added mid-sprint once `TAPS-4.1`'s Anthropic-only path hit a real account billing wall (below). Refactored `AIService.generateQuizFromPaper` into a provider-abstracted shape (`QuizGenerationProvider`) with Anthropic and OpenAI implementations normalizing to the same output shape, with a documented error-classification policy for which failures are fallback-eligible. `docs/adr/012-ai-provider-fallback.md` (new), `docs/api/quiz-generation.md` (new).   |
| `TAPS-1.14` | [#28](https://github.com/Ashish-Bhatia/TAPS/pull/28)     | Branch protection + default-branch misconfiguration found and fixed — root-caused to Codespaces' auto-injected `GITHUB_TOKEN` shadowing the real, correctly-scoped `gh` CLI session, not an account-permission gap as originally assumed. `docs/runbooks/codespaces-gh-token.md` (new).                                                                                                                                                                                                      |

All five landed with passing CI, Vitest unit tests for new logic, and docs updated in the same PR
as the code per `07-DOCUMENTATION-STANDARDS.md` — none deferred to a follow-up "docs pass." Final
`apps/api` suite as of `TAPS-4.2`: **22 test files, 85/85 tests passing**, no regressions in the
68 tests already passing at Sprint 2's close (verified via `npx vitest run`, not assumed from a
prior run's count).

## The pdf-parse 1.x→2.x bug (TAPS-4.0)

The story named `pdf-parse` as the extraction library — a reasonable default — but `pdf-parse`
currently ships two incompatible, differently-maintained major lines on npm. `pdf-parse@1.x`
(a thin wrapper around a webpack-bundled `pdf.js` frozen at 2017's `v1.10.100`) failed in two ways
once actually exercised rather than just read: its entry point throws `ENOENT` on import under
NestJS/Vitest's module loaders (a debug-mode branch reads a fixture the package doesn't ship), and
— more seriously — a byte-identical, well-formed PDF buffer (confirmed by SHA-256 hash) parsed
successfully or threw `Invalid PDF structure` depending only on an unrelated Buffer allocation
detail inside Node's shared small-buffer pool. That is a real bug in how the vendored 2017 `pdf.js`
build handles ordinary Node `Buffer`s, not a test artifact, and it is unacceptable for a pipeline
whose whole job is telling "this extraction genuinely failed" apart from "this extraction
succeeded." The fix was `pdf-parse@2.4.5` — an unrelated rewrite by a different maintainer, built on
the actively-maintained `pdfjs-dist@5.x`, which parses the same adversarial buffer correctly and
deterministically. The trade-off (a new native-binding dependency, `@napi-rs/canvas`, via
`pdfjs-dist`) and the full decision are recorded in `docs/adr/010-pdf-text-extraction.md`.

## The TAPS-4.1 → TAPS-4.2 billing wall (unplanned story added mid-sprint)

`TAPS-4.1`'s implementation — `AIService.generateQuizFromPaper`, Anthropic-only — was code-complete
and unit-tested, but its live smoke test against the real `ANTHROPIC_API_KEY` failed with a real
`400 invalid_request_error`: "Your credit balance is too low to access the Anthropic API." This is
an account billing action for the founder, not a code defect, and is tracked separately rather than
blocking the story. Rather than leave EPIC 4's question-bank generation unverifiable end-to-end,
`TAPS-4.2` was added mid-sprint: a provider-abstracted refactor (`QuizGenerationProvider`) adding an
OpenAI (`gpt-5.6-terra`) implementation, with a documented policy in
`docs/adr/012-ai-provider-fallback.md` for which Anthropic failures are fallback-eligible (billing/
credit errors, rate limits, 5xxs) versus which are not (`authentication_error`, malformed/invalid
requests — these throw rather than silently retrying against a different provider). A live smoke
test with real API keys then confirmed the full path end-to-end: Anthropic failed for real exactly
as before, the code correctly classified it as fallback-eligible, OpenAI succeeded, and validated
`QuizQuestion` rows were persisted with `aiProvider: OPENAI` (fixture and generated rows fully
cleaned up afterward, verified: 0 remaining). `TAPS-4.1` is recorded **Done** on this basis — its
acceptance criteria are satisfied end-to-end via `TAPS-4.2`'s path, with the Anthropic-primary path
specifically constrained by account credits, tracked as an open billing item below rather than a
code gap.

## The PR #27 wrong-base-branch incident

Mid-sprint, `PR #27` (`TAPS-4.1`/`TAPS-4.2`) was opened and merged against `main` instead of
`develop`. Two things combined to cause it: the repo's `default_branch` was (at the time)
misconfigured as `main` rather than `develop`, and Claude Code's self-run `gh pr create` for that
PR omitted an explicit `--base` flag, so `gh` silently targeted the repo's default branch instead of
the intended integration branch. This was caught after the merge, not before. Both branches were
reconciled to the same commit (`develop` fast-forwarded past `main`'s new tip rather than the two
histories being allowed to diverge), and — critically — the root cause was found and fixed, not just
patched around for this one PR: investigating turned up that `default_branch` being `main` and
`enforce_admins` being `false` on both `develop` and `main`'s branch protection were both
symptoms of the same underlying problem `TAPS-1.14` root-caused (below). Both were fixed and the fix
was **verified via live GitHub API calls** — `gh api repos/.../branches/{branch}/protection` showing
`enforce_admins.enabled: true` on both branches, and `gh api repos/...` showing `default_branch:
"develop"` — not assumed correct from having made the change. Branch protection now applies to
everyone including admins, which is why this sprint's own close-out PR is opened with an explicit
`--base develop` rather than relying on the (now-correct) default.

## The TAPS-1.14 root cause: Codespaces' GITHUB_TOKEN shadowing

The `gh api` 403s on branch-protection endpoints that had originally been logged against `TAPS-1.14`
as an apparent account-permission gap turned out to have a different cause entirely: GitHub
Codespaces auto-injects a `GITHUB_TOKEN` environment variable into every Codespace, deliberately
scoped down (no `admin:repo_hook`, no repo-admin branch-protection access), and that env var takes
priority over the real, separately-authenticated `gh` CLI session — silently shadowing it for any
tool that reads `GITHUB_TOKEN`/`GH_TOKEN`. The fix, now documented as a standing runbook
(`docs/runbooks/codespaces-gh-token.md`) rather than a one-off note, is `unset GITHUB_TOKEN` followed
by `gh auth refresh -h github.com -s repo,admin:repo_hook`. With the real session restored,
`enforce_admins.enabled` was set `true` on both `develop` and `main`, and the repo's `default_branch`
was changed from `main` to `develop` — both changes verified live via the API, not assumed from
having run the commands. This same shadowing recurred and was caught again while preparing this
sprint's own close-out (the security/analysis check below initially came back empty for the same
reason, confirming the runbook's "check `echo $GITHUB_TOKEN` first" guidance is worth keeping).

## Still-open / unscheduled items

Not folded into this sprint, filed or carried forward as separately-scoped items per
`10-LOOP-PREVENTION-PROTOCOL.md` Rule 3:

- **Anthropic account credits** — a billing action for the founder, not a code gap; blocks the
  Anthropic-primary path `TAPS-4.1`/`4.2` otherwise fully support. See `docs/adr/012-ai-provider-fallback.md`.
- **TAPS-1.11** — `apps/mobile` half of unit test scaffolding still pending (`apps/web` half landed
  as a side effect of Sprint 2's `TAPS-3.2`).
- **TAPS-1.17 / 1.18 / 1.19** — `.prettierignore` Next.js coverage, splitting CI's single job,
  `apps/mobile`'s `react-native-web`/`expo export` fix — all found during the Sprint 0 verification
  pass, still `Ready`.
- **TAPS-3.5 / 3.6** — the Next.js Data Cache investigation and board-specific exam hub sub-pages,
  carried from Sprint 2, still `Ready`.
- **TAPS-2.12** — tracking four `multer` high-severity DoS advisories (via `@nestjs/platform-express`)
  with no upstream fix yet available; monitor-only, no target sprint.
- **New this sprint — GitHub secret scanning and push protection are disabled repo-wide.**
  Confirmed via `gh api repos/Ashish-Bhatia/TAPS`'s `security_and_analysis` field: `secret_scanning`,
  `secret_scanning_push_protection`, `dependabot_security_updates`, `secret_scanning_non_provider_patterns`,
  and `secret_scanning_validity_checks` all show `status: "disabled"`. This repo is public and
  already handles real API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) and a real database
  connection string (`DATABASE_URL`) in `apps/api/.env` (gitignored, not tracked — confirmed clean
  in `docs/audits/audit-2026-09-11.md` §7) — worth enabling these, since a public repo gets secret
  scanning and push protection for free and the cost of a future accidental commit of a real
  credential is high. Filed here rather than fixed in-line, since enabling repo security settings is
  itself an outward-facing, hard-to-reverse-feeling change worth a deliberate go-ahead.

## What moved

All five sprint stories: **Ready → Done.** No story was left mid-sprint or silently dropped.
`TAPS-4.2` itself moved **(not planned) → Done** — the only story this sprint that wasn't part of
the original sprint backlog, added mid-sprint in direct response to `TAPS-4.1`'s billing wall.

## Verification

CI was green on all five feature-branch PRs and on both the `develop`→`main` merges that followed
(including the reconciliation after the PR #27 incident). `npx vitest run` in `apps/api` after the
last merge: 22 test files, 85/85 tests passing, no regressions in the 68 tests already green at
Sprint 2's close. All `QuizQuestion`/`PastPaper` migrations were applied and verified against the
real Neon database (`prisma migrate status`: up to date), not just a clean local migration exit
code. `apps/mobile` still has no test script (tracked as `TAPS-1.11`, unrelated to this sprint's
scope).

## Retro

**What slowed the sprint down:** the same theme twice over — process/infrastructure gaps (a
misconfigured default branch, branch protection that didn't actually bind admins, and Codespaces'
`GITHUB_TOKEN` shadowing the real `gh` session) surfacing through real incidents — a wrong-base-branch
PR merge, and a second recurrence of the same shadowing bug while preparing this very close-out —
rather than being caught by a proactive check at sprint start. Both were root-caused and fixed this
sprint (`TAPS-1.14`), and the fixes were verified live via the API rather than assumed, but the
pattern of finding infrastructure gaps reactively, through an incident, rather than proactively is
now two sprints running (Sprint 1's retro flagged a similar "stale branch tip" process gap).

**One process change to consider next sprint** (per `04-AGILE-PROCESS.md` §3): decide whether a
short, standing "infra check" — confirming `gh auth status` isn't shadowed, the default branch is
correct, and branch protection still applies to admins — becomes a lightweight sprint-start habit,
rather than something only re-derived after an incident forces it. This sprint's own audit
(`docs/audits/audit-2026-09-11.md`) already showed the value of a periodic broader pass; the open
question is whether a narrower, faster version of just the git/GitHub-config slice of it is worth
running every sprint rather than only opportunistically.

## Sprint 4

Not yet planned. Candidate stories remain in the backlog (`docs/backlog/BACKLOG.md`) with status
`Ready`, including `TAPS-1.11`, `TAPS-1.17`–`1.19`, `TAPS-2.5`–`2.10`, `TAPS-2.12`, `TAPS-3.5`/`3.6`,
plus the newly-filed GitHub secret-scanning/push-protection item above, pending Ashish's
sprint-planning approval per `04-AGILE-PROCESS.md` §3.
