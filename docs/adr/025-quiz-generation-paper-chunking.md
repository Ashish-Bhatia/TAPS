# 025 — Quiz generation: page-boundary-aware chunking + dedup

Status: Accepted

## Context

`TAPS-4.5` (filed from a live investigation on 2026-09-12, see `docs/backlog/BACKLOG.md`) found
that `AIService.generateQuizFromPaper` fails on a full-size paper. Root cause, reproduced live
against the real OpenAI API: `gpt-5.6-terra`'s `reasoning_tokens` count against the same
`max_completion_tokens: 8192` cap as visible output. A real ~150-190-question, 48-page paper
(`PastPaper cmtyqyy0z0001sahpuyhz0v24`, ~69.8k prompt tokens) exhausts the entire completion
budget on hidden reasoning before emitting any visible JSON — `finish_reason: length`, empty
`message.content`, reproduced on both the first attempt and the same-provider retry. A ~30-question
slice of that same paper succeeds cleanly (3,125 completion tokens, `finish_reason: stop`, valid
persisted-shape JSON) — the failure is specific to how much the model is asked to do in one
completion, not a broken prompt or a broken provider integration.

Note: `TAPS-4.6`'s Chanakya-mojibake investigation (`docs/adr/024-chanakya-devanagari-mojibake-conversion.md`,
not yet merged as of this writing) isolation-tested and confirmed the mojibake in this same paper's
Hindi sections is **not** the cause of this failure — removing it from the prompt entirely and
re-running against the real OpenAI API still reproduced the identical empty-output/
`finish_reason: length` failure.

## Options considered

**1. Raise `max_completion_tokens`.** Rejected as a blind bump: linear extrapolation from the one
real working data point (30 questions → 3,125 completion tokens) suggests a paper with ~150-190
questions would need on the order of 15,000-20,000 completion tokens even before accounting for
reasoning-token growth on a larger prompt — there's no cap increase that reliably scales as papers
keep growing, and it does nothing for the _next_ even-larger paper.

**2. Chunk by detected Part/section labels** (the backlog's original suggestion — this paper
segments cleanly into "Part I" through "Part V"). Rejected for this story: detecting section
labels from free-text extraction is inherently fragile (relies on the model or a regex reliably
recognizing whatever heading convention a given exam board happens to use, which varies paper to
paper and isn't guaranteed to exist at all), and the actual evidence (page markers) needed for
chunking is already mechanically exact and universally present — every `PastPaper.extractedText`
in this codebase carries `pdf-parse`'s own `-- N of M --` page markers by default (confirmed
against the installed package: `ParseParameters.ts`'s default `pageJoiner`), regardless of the
source paper's own internal structure.

**3. Page-boundary-aware chunking** (chosen) — split `extractedText` into fixed-size, overlapping
groups of _pages_ using the markers already present in every extraction, generate questions per
chunk through the existing per-provider fallback/retry pipeline unchanged, then dedupe and persist
once. Works for any paper regardless of whether it has labeled sections, and the chunk boundary is
mechanically exact rather than inferred.

**4. OpenAI's Batch API.** Considered and explicitly deferred, not because it's a bad idea in
general, but because it solves a different problem than the one this story has: Batch API halves
per-token cost and removes real-time rate-limit pressure for _large volumes_ of async, non-urgent
requests (its own selling point), typically completing within a 24-hour SLA window rather than
seconds — it does not, on its own, raise or change a single request's `max_completion_tokens`
budget or `finish_reason: length` behavior at all, so it would not have fixed this specific
failure even if adopted. At this project's actual scale (one admin manually triggering generation
per `PastPaper`, via `POST /past-papers/:id/generate-quiz`, not a bulk/scheduled pipeline
processing many papers unattended) and budget (a small, pre-revenue project — see
`docs/adr/012-ai-provider-fallback.md`'s Anthropic credit-balance context), Batch API's async
completion model would turn a currently-synchronous admin action into a polling/webhook flow for a
cost saving that doesn't matter yet, while doing nothing to address the actual root cause. Revisit
if/when this pipeline runs many papers unattended rather than one at a time on demand.

## Decision

Added `apps/api/src/ai/paper-chunking.ts`:

- `splitIntoPages`: parses `extractedText` back into its per-page pieces using the `-- N of M --`
  markers. Text with no marker at all (a short paper, or any input that predates/bypasses
  `pdf-parse`) is treated as a single page — this is what keeps chunking a genuine no-op for
  anything that already fits in one call.
- `chunkPastPaperText`: groups pages into overlapping chunks. **`DEFAULT_PAGES_PER_CHUNK = 8`**,
  chosen directly from the one real data point available: the proven-safe ~30-question/3,125-token
  slice, and the full paper's ~150-190 questions over 48 pages (≈3.1-4.0 questions/page) — 8 pages
  lands at roughly 25-32 questions/chunk, comfortably inside the proven-safe range with real
  headroom, without so many chunks that per-paper API call count balloons needlessly (a 48-page
  paper becomes ~7 sequential calls, not 48). **`DEFAULT_OVERLAP_PAGES = 1`**: the minimum overlap
  that guarantees a question whose text sits exactly at a page boundary still appears whole in at
  least one chunk, rather than being cut in half in both and extracted incompletely (or not at
  all) by either.
- `dedupeQuestions`: the overlap above means the overlapped page's question(s) get independently
  (and, per the extraction prompt's own "do not invent questions not actually in the source text"
  instruction, near-identically) generated by both chunks that saw it. Two questions are treated
  as the same one if their text is identical after trimming, collapsing internal whitespace, and
  case-folding — deliberately simple exact-normalized matching rather than fuzzy similarity,
  keeping the first (earlier-chunk) occurrence.

`AIService.generateQuizFromPaper` now chunks `extractedText`, runs each chunk through the existing
`extractQuestionsWithFallback` (TAPS-4.2's provider-fallback policy, completely unchanged — it
operates identically whether its input is a whole paper or one chunk of it) **sequentially, not
concurrently** — this project's scale doesn't need concurrent provider calls, and sequential stays
well clear of either provider's rate limits; revisit if per-paper generation latency becomes a
real problem — tags each resulting question with which provider produced it (a chunk-level
fallback can trigger independently per chunk, so different chunks' questions can legitimately carry
different `aiProvider` values), dedupes the combined list, and persists everything in one
transaction exactly as before (all-or-nothing).

**`parseAndValidate` (in `ai.service.ts`) was relaxed to accept an empty array (`[]`) as a valid
result**, not malformed output. Previously an empty array burned the one same-provider retry and
then failed the whole call — correct when the _entire_ paper produced nothing, but wrong once a
single call can legitimately cover just a closing chunk that's mostly exam-hall conduct
instructions with no questions in it at all (a real, confirmed shape in this exact paper's last
page — see `docs/audits/2026-09-13-followup.md`'s `extractedText` deep-dive).

## Consequences

**Makes easier:** a full-size paper no longer needs its `max_completion_tokens` budget guessed at
or bumped blindly, and the fix scales to a future even-larger paper the same way it does to this
one, since chunk size is bounded by the questions-per-page ratio, not the paper's total length.

**Makes harder / known limitations:**

- **This session's verification is unit-level, not a live end-to-end run against the real OpenAI
  API.** The original `TAPS-4.5` backlog acceptance criteria called for "a real end-to-end test
  against this exact `PastPaper` (`cmtyqyy0z0001sahpuyhz0v24`) succeeding with real generated
  `QuizQuestion` rows persisted." That real run was **not** repeated in this session — the mocked
  reproduction below stands in for it, per this story's explicit scope. Recorded here rather than
  silently narrowed: a real run against the live paper (`POST /past-papers/:id/generate-quiz`,
  with a real Anthropic/OpenAI key) is still the strongest remaining confirmation and is worth
  doing before this is treated as fully closed in production, not just in tests.
- The "reproduces `finish_reason: length`" unit test necessarily simulates the failure mechanism
  (a mock that returns empty content once the combined prompt crosses a fixed length) rather than
  calling the real OpenAI API, which a unit test structurally cannot do (it needs a real,
  billed `OPENAI_API_KEY`) — consistent with every other provider-failure test already in
  `ai.service.spec.ts` (TAPS-4.1/4.2's own tests mock the same SDK boundary).
- `DEFAULT_PAGES_PER_CHUNK = 8` is extrapolated from one paper's one working data point (a
  ~30-question, ~3,125-completion-token slice), not measured across a range of real papers of
  different densities — a paper with unusually dense multi-part questions per page could still
  need a smaller chunk size than the default provides. The constant is a single named export
  specifically so it's easy to tune later without touching the chunking algorithm itself.
- Sequential (not concurrent) per-chunk generation means a 7-chunk paper's generation call takes
  roughly 7x one chunk's latency — an explicit trade-off for staying clear of rate limits at this
  project's current scale, not an oversight.
- `dedupeQuestions`'s exact-normalized-text matching would miss a duplicate if the model phrases
  the same overlapped-page question meaningfully differently between the two chunks that saw it
  (e.g. paraphrasing rather than extracting verbatim) — considered low-risk given the prompt's
  explicit "do not invent questions… extract" instruction, but not fuzzy-matched, so it isn't
  guaranteed impossible.
