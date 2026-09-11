# 011 — AI quiz generation: model, retry contract, and field trust boundary

Status: Accepted

## Context

`TAPS-4.1` is `05-ARCHITECTURE.md` §5's first real `AIService` method:
`generateQuizFromPaper(pastPaperId)`, reading a `PastPaper`'s `extractedText` (`TAPS-4.0`) and
having Claude turn it into `QuizQuestion` rows. Three decisions had real trade-offs worth
recording: which model to call, how to handle a malformed model response without silently
inserting garbage, and how much of the model's own output to trust versus data already known
from the `PastPaper` record.

**Live verification status:** the real Anthropic API call this story requires (against
`ANTHROPIC_API_KEY`) was attempted and failed with `401 authentication_error: "API key is
invalid."` — the key currently in `apps/api/.env` is a placeholder, not a real key, and
`ANTHROPIC_API_KEY` is not currently set as a Fly secret at all (`fly secrets list -a taps-api`
shows only `DATABASE_URL`/`ALLOWED_ORIGIN`). Per this story's explicit instructions, that failure
was reported as a blocker rather than routed around (no other provider substituted, no mocked
response used to fake a passing live call) — see `docs/backlog/BACKLOG.md`'s `TAPS-4.1` row. The
code below is written and unit-tested (with the Anthropic client mocked, per the test plan) but
has not yet been exercised against a real model response.

## Decision

**Model: `claude-sonnet-5`** (the current-generation Sonnet model at the time this was written —
checked against the live model reference rather than carried over from training data, since the
story explicitly required not hardcoding a guess). Sonnet rather than Opus: extracting
question/answer pairs from text that's already fully supplied in the prompt is a single-call,
well-specified-schema extraction task, not open-ended multi-step reasoning — the workload this
repo's own guidance characterizes as not needing the top-tier model. Should extraction quality
prove insufficient in practice (e.g. subject/topic/difficulty tagging judged too shallow), the
isolation this ADR's parent architecture decision (05-ARCHITECTURE.md §5) provides makes
upgrading to Opus a one-line change with no controller/frontend impact.

**Retry contract: parse and validate strictly, retry once with the failure fed back, then throw
`AIQuizGenerationError` (502) rather than insert anything.** The model is prompted to return only
a JSON array (no markdown fences) of objects matching a fixed shape. A response is rejected if it
isn't valid JSON, isn't an array, or any item fails structural validation (wrong types, an
`options` array shorter than 2, `correctOption` out of range, or a `difficulty` outside
`EASY`/`MEDIUM`/`HARD`). On the first rejection, one retry is sent as a follow-up turn in the same
conversation (the bad output plus an explicit "reply with ONLY a JSON array" instruction) — a
fresh, context-free retry of the identical prompt was considered and rejected, since replaying the
same failure back to the model gives it something concrete to correct rather than blindly hoping
for a different roll. If the retry also fails validation, the whole call fails loudly; no
partially-validated or best-effort rows are ever written. Every extracted question in a
successful response is persisted in a single `prisma.$transaction` — either the full batch lands
or none of it does, so a mid-batch database error can't leave a silently incomplete question bank
with no signal that generation didn't fully succeed.

**Field trust boundary: `QuizQuestion.subject` is always the known `PastPaper.subject`, never the
model's own guess**, even though the prompt asks the model to return a `subject` field per
question (kept in the contract for the model's own internal consistency and because
`08-AI-FEATURES-SPEC.md` describes the output as tagged by subject). `topic` and `difficulty` —
information the `PastPaper` record doesn't carry — do come from the model. This follows
`08-AI-FEATURES-SPEC.md` §5's guardrail in spirit: never let a generated field silently override a
fact already known to be true from ingested data, even in a field the model was also asked to
produce.

**`QuizQuestion.pastPaperId`'s relation uses `onDelete: Restrict`, matching this schema's existing
convention** (`docs/adr/004-content-schema-design.md`) for required foreign keys — deleting a
`PastPaper` that already has a generated question bank attached fails loudly rather than silently
cascading it away, consistent with the same reasoning already applied to
`Syllabus`/`PastPaper` → `ExamBoard`.

## Consequences

- **Easier:** a bad/ambiguous source PDF or a model hallucination surfaces as a clear, typed
  failure (`PastPaperNotExtractedError` for a paper not ready, `AIQuizGenerationError` for a model
  output that never validated) instead of corrupting the question bank with partial or malformed
  rows; swapping models later is a one-constant change confined to `ai.service.ts`.
- **Harder:** a systematically malformed prompt or a model that reliably fails validation costs
  two full API calls (and their latency/cost) before failing, rather than one; there is currently
  no queued/async version of this endpoint, so a paper with many questions makes the admin
  `POST /past-papers/:id/generate-quiz` request itself slow — the same synchronous-request
  trade-off `docs/adr/010-pdf-text-extraction.md` already accepted for ingestion, tracked the same
  way as a future backlog item rather than solved speculatively here.
- **Open, pending the founder's decision on `ANTHROPIC_API_KEY`:** whether the retry-then-fail
  contract and the prompt itself actually produce good question banks in practice is unverified —
  this ADR's design is validated by mocked unit tests only, not yet by a real model response.
