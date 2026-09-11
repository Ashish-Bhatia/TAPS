# AI Quiz Generation

`TAPS-4.1`/`TAPS-4.2` — the first real method behind `AIService` (`05-ARCHITECTURE.md` §5).
Admin-only, JWT-guarded (`TAPS-2.3`'s pattern), same as the rest of the `PastPaper` CMS routes in
`docs/api/past-papers.md`. Question-bank generation only — this does **not** cover user-facing
quiz-taking (that's `TAPS-5.1`, out of scope here).

## `POST /past-papers/:id/generate-quiz`

Runs `AIService.generateQuizFromPaper` against the `PastPaper` identified by `:id` and persists
the result as `QuizQuestion` rows.

- **Auth:** `Authorization: Bearer <accessToken>` from `POST /auth/login` (see `docs/api/auth.md`)
- **Behavior:**
  1. Looks up the `PastPaper`. Fails if it doesn't exist.
  2. Requires `extractionStatus: DONE` (i.e. `TAPS-4.0`'s ingestion pipeline succeeded and
     `extractedText` is populated) — a paper still `PENDING` or `FAILED` has nothing to generate
     from.
  3. Sends `extractedText` to Anthropic (`claude-sonnet-5` — see
     `docs/adr/011-ai-quiz-generation.md`), asking for a JSON array of question/answer pairs
     tagged by topic and difficulty.
  4. Strictly parses and validates the response. A malformed or schema-invalid response is
     retried once against the same provider (with the failure fed back to the model); a second
     failure aborts that provider's attempt — nothing is written to the database yet.
  5. **`TAPS-4.2`:** if Anthropic's _call itself_ failed (not a malformed-JSON response) in a
     fallback-eligible way — a billing/credit error, a rate limit, or a 5xx — the identical
     request is retried against OpenAI (`gpt-5.6-terra`), through the same parse/validate/
     retry-once contract. An `authentication_error` or any other malformed/invalid-request
     failure does **not** fall back — it aborts immediately, same as `TAPS-4.1`. See
     `docs/adr/012-ai-provider-fallback.md` for the exact policy table.
  6. On success, persists every extracted question as a `QuizQuestion` row in one transaction
     (all rows or none), each with `aiGenerated: true`, `reviewedByAdmin: false` (per
     `08-AI-FEATURES-SPEC.md` §5 — an AI-generated question is never presented as admin-reviewed
     until an admin actually reviews it), and `aiProvider` set to whichever provider actually
     produced the batch (`ANTHROPIC` unless a fallback happened, in which case `OPENAI`).
- **Response:** `201 Created`

  ```json
  { "count": 12 }
  ```

  Only the count, not the questions themselves — keeps the response small regardless of how many
  questions a paper yields. Fetching the generated `QuizQuestion` rows (which would surface each
  row's `aiProvider`) is a future read endpoint, not part of this story.

- **Errors:**
  - `401 Unauthorized` — bearer token missing/invalid/expired
  - `404 Not Found` — no `PastPaper` with that id
  - `422 Unprocessable Entity` — the `PastPaper` exists but `extractionStatus` isn't `DONE`
  - `502 Bad Gateway` — every available provider failed. The response body's `message` includes
    the underlying failure detail(s); nothing is written to the database when this happens. Two
    distinct cases share this status:
    - Anthropic failed in a **non**-fallback-eligible way (`authentication_error`, a malformed/
      invalid request, or a malformed-JSON response that didn't validate after one retry) — the
      message describes that one failure.
    - Anthropic failed in a fallback-eligible way **and** the OpenAI retry also failed — the
      message describes both underlying failures (`AIAllProvidersFailedError`).

## Live verification status

Verified end-to-end for real (see `docs/adr/012-ai-provider-fallback.md`): a live smoke-test call
against a real `PastPaper` fixture found Anthropic failing with a real account-level error (an
insufficient credit balance — see the ADR for the exact, slightly surprising shape that error
actually came back in), correctly classified as fallback-eligible, and OpenAI succeeding on the
retry — producing validated `QuizQuestion` rows persisted with `aiProvider: OPENAI`. Anthropic
succeeding on its own, standalone, is still unverified (a real account/billing action, not a code
defect, is needed to resolve that — see the `TAPS-4.1` row in `docs/backlog/BACKLOG.md`), but the
endpoint as a whole is live-verified: it produces a real question bank today regardless.
