# 012 — AI provider fallback: Anthropic → OpenAI

Status: Accepted

## Context

`TAPS-4.1` built `AIService.generateQuizFromPaper` against a single provider (Anthropic). Its live
verification was blocked (`docs/adr/011-ai-quiz-generation.md`) by an invalid placeholder
`ANTHROPIC_API_KEY`. For `TAPS-4.2`, the founder supplied real `ANTHROPIC_API_KEY` and
`OPENAI_API_KEY` values (locally in `apps/api/.env` and as Fly secrets on `taps-api`), and this
story's brief is to make `generateQuizFromPaper` resilient to Anthropic being unavailable — for a
transient reason (rate limit, a 5xx) or an account-level one (a billing/credit problem) — by
retrying the identical request against OpenAI, without ever silently routing around an error that
means the request itself, or the caller's credentials, are actually invalid.

**Live verification status:** with the real key in place, a real `generateQuizFromPaper` call was
made against a real `PastPaper` fixture (created and cleaned up for this test — see the
`AIService.generateQuizFromPaper` smoke test procedure below). Anthropic failed for real — see
"Anthropic's error taxonomy vs. what actually came back" below — the code correctly classified that
failure as fallback-eligible, retried against OpenAI (`gpt-5.6-terra`), and OpenAI succeeded,
producing 2 validated questions persisted as `QuizQuestion` rows with `aiProvider: OPENAI`. This is
the first time any part of `generateQuizFromPaper` has been exercised against a real model
response — TAPS-4.1's own scope (a _standalone_ successful Anthropic call) is still unverified,
since the account's actual blocker turned out to be insufficient credit balance, not the invalid
key TAPS-4.1 hit; see `docs/backlog/BACKLOG.md`'s `TAPS-4.1` row.

## Decision

**Provider abstraction: a `QuizGenerationProvider` interface with one method, `callModel(messages):
Promise<string>`** (`apps/api/src/ai/ai.providers.ts`). Deliberately narrow — "send these chat
turns, get the model's raw text back" — so that everything downstream of it (prompt construction,
JSON parse/validate, the retry-once-on-malformed-JSON contract, and the `PastPaper.subject`
trust-boundary rule) stays in `AIService` completely unchanged from `TAPS-4.1`, run identically
regardless of which provider implements the interface. Both `AnthropicQuizProvider` and
`OpenAIQuizProvider` must therefore produce plain response text that normalizes to the exact same
`RawQuizQuestion` shape (`question`/`options`/`correctOption`/`explanation`/`subject`/`topic`/
`difficulty`) before validation ever runs — persistence code downstream never has to know or care
which provider produced a given row, only `aiProvider` (the new `QuizQuestion` column, see below)
records that after the fact.

**Model: `gpt-5.6-terra`** for the OpenAI side (checked against the live OpenAI model reference at
the time this was written — GA since 2026-07-09 — not hardcoded from training data). Terra is
OpenAI's mid ("balances intelligence and cost") tier of the GPT-5.6 family, chosen for the same
reason `claude-sonnet-5` was chosen over Opus in ADR 011: this is a single-call,
well-specified-schema extraction task, not open-ended multi-step reasoning that would justify the
flagship `gpt-6-astra` tier. GPT-5.x-family chat models require `max_completion_tokens` in place of
the older `max_tokens` in the Chat Completions API — used accordingly in `OpenAIQuizProvider`.

**Fallback policy — exact, not to be extended with additional cases:**

| Anthropic outcome                                                                    | Fallback to OpenAI? | Persisted `aiProvider`                                |
| ------------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------- |
| Success                                                                              | —                   | `ANTHROPIC`                                           |
| Billing/credit error                                                                 | Yes                 | `OPENAI` (on success)                                 |
| Rate limit (429 `rate_limit_error`)                                                  | Yes                 | `OPENAI` (on success)                                 |
| 5xx server error                                                                     | Yes                 | `OPENAI` (on success)                                 |
| `authentication_error` (401)                                                         | No                  | — (throws as-is)                                      |
| Any other malformed/invalid-request error (400 `invalid_request_error`, 403, 404, …) | No                  | — (throws as-is)                                      |
| Same-provider malformed-JSON-after-retry (TAPS-4.1's existing contract, unchanged)   | No                  | — (throws as-is)                                      |
| Fallback-eligible Anthropic failure **and** the OpenAI attempt also fails            | (already attempted) | — (`AIAllProvidersFailedError`, both errors reported) |

Implemented as `isAnthropicFallbackEligible(cause)` in `ai.providers.ts`, called from
`AIService.extractQuestionsWithFallback` on the raw `cause` of a caught `AIQuizGenerationError` —
never on a malformed-JSON failure, which carries no `cause` at all (it isn't an API-call failure,
so it's structurally excluded from fallback eligibility rather than special-cased).

**Anthropic's error taxonomy vs. what actually came back.** Anthropic's documented error reference
(`platform.claude.com/docs/en/api/errors`, checked while writing this ADR) describes a distinct 402
`billing_error` type for "an issue with your billing or payment information." The real, live call
made to verify this story returned something different: a plain 400 `invalid_request_error` whose
_message_ — not its `type` — read "Your credit balance is too low to access the Anthropic API.
Please go to Plans & Billing to upgrade or purchase credits." (Anthropic's own developer community
has flagged this same inconsistency independently.) Since `type`/`status` alone cannot distinguish
this from a genuinely malformed request, `isAnthropicFallbackEligible` also matches `/credit
balance/i` against the error message as a second, necessary signal — treating both the documented
`billing_error` type and this observed 400 shape as the same "billing/credit error" fallback-eligible
case. A 400 `invalid_request_error` whose message does _not_ mention a credit balance still falls
through to "no fallback," per the table above.

**`QuizQuestion.aiProvider` (`enum AIProvider { ANTHROPIC OPENAI }`), defaulted to `ANTHROPIC`.**
Every write path sets it explicitly (`ANTHROPIC` on the plain success path, `OPENAI` only after a
fallback-eligible Anthropic failure and a successful OpenAI retry), so the default only matters as
a schema-level safety net for a hypothetical bare insert, not as something the application code
relies on.

## Consequences

- **Easier:** a real-world Anthropic outage or account-billing issue no longer blocks quiz
  generation outright — the admin `POST /past-papers/:id/generate-quiz` endpoint keeps working as
  long as at least one provider is healthy, and every persisted `QuizQuestion` row records which one
  actually produced it. Adding a third provider later is a new `QuizGenerationProvider`
  implementation plus an `extractQuestionsWithFallback` branch, not a rewrite of the parsing/
  validation/persistence logic.
- **Harder:** a request that hits a fallback-eligible Anthropic failure now costs up to 2 Anthropic
  calls (TAPS-4.1's own malformed-JSON retry, if that also happens to fire first) plus up to 2
  OpenAI calls before failing outright — more latency and cost than a single-provider design in the
  worst case. The credit-balance message-matching in `isAnthropicFallbackEligible` is inherently a
  little fragile (it depends on Anthropic's exact wording rather than a stable `type`/`status`) —
  flagged here explicitly rather than hidden in a comment only, so a future Anthropic API change
  that reword this message is something to watch for, not silently break against.
- **Open:** `TAPS-4.1`'s own narrow scope — Anthropic succeeding on its own, standalone — is still
  unverified; the account's real blocker (insufficient credit balance) is a founder/billing action,
  not something this story's code can resolve. See the `TAPS-4.1` row in `docs/backlog/BACKLOG.md`.
