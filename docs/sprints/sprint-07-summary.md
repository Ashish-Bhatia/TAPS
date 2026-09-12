# Sprint 7 — closing out the quiz-generation pipeline, main-sync, and infra hygiene

Sprint dates: 2026-09-12–09-13 (continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `929c1cb` (Sprint 6 close-out, `TAPS-2.13` landed
unplanned right after). Result: `develop` at `5fb23f7` (`TAPS-4.7` merge, #70) as of this doc's own
commit — five PRs merged (#67–#71), CI green on every code-bearing one, plus `main` synced to that
same tip via #71.

Where Sprint 6 built EPIC 6 (mobile) end to end, Sprint 7 was almost entirely about making EPIC 4's
quiz-generation pipeline actually work against a real paper in production — and, once that was
proven, catching and fixing a real near-miss where the first "working" production row turned out to
be corrupted evidence of the very bugs being fixed.

## What shipped

| Story                 | PR(s)                                                | Summary                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-2.13`           | [#66](https://github.com/Ashish-Bhatia/TAPS/pull/66) | Cloudflare R2 object storage + `apps/api` upload path — carried into this sprint's main-sync alongside Sprint 6's mobile work (`TAPS-6.1`–`6.5`). Landed just ahead of formal Sprint 7 planning; see Sprint 6's own summary for detail.            |
| —                     | [#67](https://github.com/Ashish-Bhatia/TAPS/pull/67) | Docs-only: filed `TAPS-4.5`/`TAPS-4.6` findings (previously only an uncommitted local diff) into the tracked backlog.                                                                                                                              |
| `TAPS-4.6`            | [#68](https://github.com/Ashish-Bhatia/TAPS/pull/68) | Chanakya-font Devanagari mojibake fix — see below.                                                                                                                                                                                                 |
| `TAPS-4.5`            | [#69](https://github.com/Ashish-Bhatia/TAPS/pull/69) | Page-boundary-aware chunking + dedup for quiz generation — see below.                                                                                                                                                                              |
| `TAPS-4.4`/`TAPS-4.7` | [#70](https://github.com/Ashish-Bhatia/TAPS/pull/70) | Deleted the corrupted production `PastPaper` row and re-ran ingestion + generation end-to-end against real R2/Neon/OpenAI — see below.                                                                                                             |
| `TAPS-1.30`           | (branch cleanup, ops)                                | 17 remote branches down to 3 (`main`, `develop`, one deliberately-abandoned `feature/TAPS-1-fix-prepare-script`) — 14 stale-but-merged branches deleted, closing the hygiene gap `docs/audits/2026-09-13-followup.md` had just enumerated in full. |
| `TAPS-1.29`           | (ops, GitHub UI)                                     | Branch protection, Dependabot, and the repo's security overview independently re-verified via the GitHub UI directly (not the API) — see below.                                                                                                    |
| —                     | [#71](https://github.com/Ashish-Bhatia/TAPS/pull/71) | Synced `develop` (Sprint 6 + Sprint 7, everything above) to `main`, triggering `TAPS-1.22`'s deploy-on-merge pipeline — a real production deploy, not a dry run.                                                                                   |

All code-bearing PRs (`#68`, `#69`) landed with passing CI, tests, and docs updated in the same PR
as the code, per `07-DOCUMENTATION-STANDARDS.md`. `#67` and `#70` were deliberately docs/ops-only —
no `apps/api` code changed in either, confirmed by each PR's own "test suite unaffected" note.

## `TAPS-4.6`: Chanakya-font Devanagari mojibake — real investigation, not a generic assumption

The failure mode looked, at first glance, like the well-documented Kruti Dev pattern: valid Unicode
that decodes as garbled Latin-range text. It wasn't. Kruti Dev-style mojibake normally comes out as
plain ASCII gibberish (Devanagari glyphs sit on ordinary letter code points); this paper's garbled
sample (`¬˝‡Ÿ-¬òÊ`) decodes to Latin-1-supplement and symbol codepoints — hungarumlaut, double
dagger, lozenge, summation — that a genuine Kruti Dev source would never produce. Reasoning from the
garbled text alone, or reaching for a generic Kruti Dev table, would have been guessing.

Instead, the real source PDF was fetched directly and its embedded font resources inspected: the
Hindi sections use **Chanakya** (`/BaseFont /LSLLKX+Chanakya`, all four weights embedded), not Kruti
Dev or DevLys — ground truth from the file itself, not inference. The remaining question — why
_symbols_ rather than plain ASCII — was answered by decompressing and inspecting the font's own
embedded `ToUnicode` CMap directly: it maps Chanakya's internal codes to unrelated Latin-1/symbol
Unicode (e.g. raw code `0xFD → U+02DD` hungarumlaut) instead of to Devanagari, almost certainly an
artifact of whatever DTP-to-PDF pipeline produced the paper originally. A conversion table was
derived by composing that real CMap with the open-source `hindi-font-converter` project's Chanakya
table, restricted to only the codes this document's CMap actually uses, then validated against two
independent real samples from the paper's cover page — both converting to grammatically correct
Hindi (`¬˝‡Ÿ-¬òÊ` → `प्रश्न-पत्र`, "Question Paper"; `◊ÈÅÿ ¬⁄UËˇÊÊ ¬ÈÁSÃ∑§Ê` → `मुख्य परीक्षा पुस्तिका`,
"Main Examination Booklet"). Full write-up, including the documented scope limit (this table is
derived from one PDF's embedded CMap, not a universal Chanakya decoder): `docs/adr/024-chanakya-devanagari-mojibake-conversion.md`.

Implemented as `apps/api/src/ingestion/chanakya-devanagari.ts`, gated per-whitespace-token
(≥30% non-ASCII) rather than applied document-wide, since several table entries are plain ASCII
letters that would otherwise corrupt genuine English content (multiple-choice option markers like
"A) B) C) D)"). 15 new unit tests; full `apps/api` suite 170/170 passing at merge.

## `TAPS-4.5`: page-boundary-aware chunking + dedup

Root cause, reproduced live against the real OpenAI API: `gpt-5.6-terra`'s `reasoning_tokens` count
against the same `max_completion_tokens: 8192` cap as visible output, so a full ~150–190-question,
48-page paper exhausts the entire completion budget on hidden reasoning before emitting any visible
JSON (`finish_reason: length`, empty content), while a ~30-question slice of the same paper succeeds
cleanly. Chunking by paper page boundaries — using `pdf-parse`'s own `-- N of M --` markers, present
in every extraction by default — was chosen over the originally-suggested chunk-by-labeled-Part
approach, since section labels aren't guaranteed to exist or be reliably detectable across every
exam board's paper format, while page markers are mechanically exact regardless of a paper's
internal structure. `DEFAULT_PAGES_PER_CHUNK = 8` / `DEFAULT_OVERLAP_PAGES = 1` are both derived
from the one real working data point (the proven-safe ~30-question/3,125-token slice); a
`dedupeQuestions` pass (exact match after trim/case-fold/whitespace-collapse) collapses the
duplicate a 1-page overlap can produce at a chunk boundary. Full reasoning, including the three
rejected alternatives: `docs/adr/025-quiz-generation-paper-chunking.md`.

**OpenAI's Batch API was explicitly considered and deferred**, not for being a bad idea but for
solving a different problem: it addresses cost and rate-limit pressure at volume via async,
typically-24h-SLA processing — it does not raise or change a single request's
`max_completion_tokens` budget, so it would not have fixed this specific failure even if adopted.
At this project's current scale (one admin manually triggering generation per paper, not a bulk
pipeline), its polling/webhook model would add real complexity for a cost saving that doesn't
matter yet — worth revisiting only if this pipeline ever runs many papers unattended.

21 new unit tests (12 pure chunking/dedup logic, 3 reproducing the real failure mechanism and
proving chunking avoids it, plus a boundary-spanning dedup case); full `apps/api` suite 175/175 at
merge. This session's own verification was unit-level (mocked providers) only — the original
acceptance criteria's live end-to-end run against the real API was explicitly deferred to `TAPS-4.7`,
not silently dropped.

## `TAPS-4.4`/`TAPS-4.7`: the corrected production row — closed on the second attempt, not the first

`TAPS-4.7` deleted the one existing `PastPaper` row and re-ran ingestion + quiz generation end to
end against real production services — real R2, real Neon DB, real OpenAI (Anthropic's
credit-balance block, per `docs/adr/012-ai-provider-fallback.md`, is confirmed still standing and
fell back correctly on all 7 chunks). Result: a new `PastPaper` row with real, confirmed Devanagari
at both known sample locations and the old mojibake strings verified absent, split into exactly 7
chunks as `docs/adr/025`'s own prediction expected, and **225 `QuizQuestion` rows persisted with
zero duplicates spanning the chunk overlap boundary** — cross-checked by a direct DB re-query, not
just the in-memory result.

This is worth stating plainly rather than glossing over: **this closed out on the second attempt at
"done," not the first.** The `PastPaper` row that existed in production going into this sprint —
the one `docs/audits/2026-09-13-followup.md` found and initially took as evidence `TAPS-4.4` was
incidentally resolved — was itself created as a side effect of reproducing `TAPS-4.5`/`TAPS-4.6`'s
bugs live against production, not as a deliberate content-sourcing action, and it carried the
uncorrected mojibake and the unchunked-generation failure that this sprint's other two stories then
had to fix. Had that first row been accepted as "TAPS-4.4: Done" without the live re-verification
`TAPS-4.7` performed, production would have shipped corrupted Hindi text and no persisted quiz
questions under a story marked complete. The row was deleted only after the new run was fully
confirmed good — a deliberate ordering choice, not an accident — so production was never left with
zero `PastPaper` rows on the strength of an unconfirmed fix.

## `TAPS-1.30`: branch cleanup

`docs/audits/2026-09-13-followup.md`'s full branch reconciliation had just enumerated 14 branches
worth deleting (12 additional merged branches beyond the 2 a prior audit had spot-checked, plus one
deliberately-abandoned attempt) against a GitHub repo setting that evidently doesn't auto-delete
head branches on merge. All 14 have now been deleted: `git ls-remote --heads origin` today lists
exactly 3 branches (`main`, `develop`, and `feature/TAPS-1-fix-prepare-script` — the one branch
confirmed to hold a deliberately-rejected first attempt at work that shipped a different way, kept
as historical record rather than treated as recoverable). Down from 17.

## `TAPS-1.29`: security controls re-verified via the GitHub UI, not the API

Every attempt to read branch-protection, Dependabot alert, and `security_and_analysis` state via the
GitHub REST API this sprint (and in both of this sprint's own audit passes) returned the identical
`403 Resource not accessible by integration` — the ambient Codespaces `GITHUB_TOKEN`'s scope, not a
real permissions gap (the authenticated account itself has `admin: true` on the repo). **Stated
plainly rather than hidden: Claude Code's token was scope-blocked on this twice** — once in
`docs/audits/2026-09-13-full-audit.md`'s branch-protection/`security_and_analysis` checks, and again
in `docs/audits/2026-09-13-followup.md`'s Dependabot-alerts check. Both audits correctly reported
`UNKNOWN` rather than guessing. Branch protection, Dependabot's enabled state, and the repo's
security overview were independently re-verified this sprint the only way this token scope allows:
directly in the GitHub Settings UI, as the repo owner, rather than through `gh`/the API. That
re-verification is what surfaced `TAPS-1.32` and `TAPS-1.33` below — real findings the API-blocked
audits could not have produced on their own.

## What moved

`TAPS-2.13`, `TAPS-4.4`, `TAPS-4.5`, `TAPS-4.6`, `TAPS-4.7`, `TAPS-1.29`, `TAPS-1.30` — all
**Done**. `TAPS-1.22` (deploy-on-merge pipeline) — exercised for real, not just re-confirmed: PR #71
synced `develop` to `main`, triggering a real production deploy. No story was left mid-sprint or
silently dropped.

**Still open, not attempted this sprint:**

- **`TAPS-1.31`** (which LLM vendor to standardize on, given Anthropic's standing credit-balance
  block forcing every real generation onto the OpenAI fallback path) — explicitly deferred. This is
  the founder's call, not an engineering decision, and is not scheduled.
- **`TAPS-1.32`** (new) — three High-severity `multer` denial-of-service advisories, confirmed
  production-affecting, found via the GitHub-UI Dependabot check above. Not yet started.
- **`TAPS-1.33`** (new) — CodeQL code scanning setup, currently showing "Needs setup" on the repo's
  security overview, found the same way. Not yet started.
- The remaining Dependabot alerts tagged Development scope (lower severity, dev-dependency-only
  exposure) — lower priority, unscheduled.

## Retro

`04-AGILE-PROCESS.md` §3 asks for one process change to try next sprint. The last three sprints'
retros have named a recurring theme: infra/deploy gaps found reactively, via a live incident, rather
than proactively. **That theme did not repeat in the same form this sprint** — no live incident
forced a fix this time. Its equivalent near-miss instead was `TAPS-4.4` almost being marked Done on
a corrupted production row before a deliberate live-verification pass (`TAPS-4.7`) caught that the
row's Hindi text was still mojibake and its `QuizQuestion` count was still zero.

**The takeaway to carry forward is the discipline that caught it, not a new problem to fix.**
`TAPS-4.7` existed specifically because this project's Definition of Done already refuses to accept
"a row exists in the DB" as proof a fix works — it insisted on re-querying the actual
`extractedText` for both known Devanagari samples and re-querying `QuizQuestion` counts directly,
rather than trusting the in-memory result of the generation call. That's the same "verify against
the real system before merge, not after an incident forces it" pattern Sprint 5 and Sprint 6 both
named — this sprint is evidence it's holding for a third time running, now catching a near-miss
before it shipped rather than an incident after it did. Keep requiring live re-verification of the
_specific_ claim a story makes (not an adjacent proxy for it) before marking anything Done that
touches production data.

## Sprint 8

Not yet planned. Real candidates carried forward, none yet approved:

- `TAPS-1.32` (multer DoS advisories) and `TAPS-1.33` (CodeQL setup) — both new, both
  production/security-adjacent, neither started.
- `TAPS-1.31` (Anthropic vendor decision) — waiting on the founder, not schedulable as engineering
  work.
- Sprint 5/6's own carryover, still untouched: `TAPS-1.12`/`1.13` (`packages/types`/`packages/ui` as
  real shared workspaces), `TAPS-2.5` (Prisma 7.x/8.x upgrade), `TAPS-2.8` (`deepmerge-ts`
  advisory), `TAPS-2.12` (the other multer DoS advisories, tracked before `TAPS-1.32` narrowed to
  the three production-affecting ones specifically).
- EPIC 7 (AI study-plan generator) and EPIC 8 (AI doubt-solving assistant) have no stories yet.
