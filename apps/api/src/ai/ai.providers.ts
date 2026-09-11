import { Logger } from '@nestjs/common';
import Anthropic, { APIError as AnthropicAPIError } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AIQuizGenerationError } from './ai.errors.js';

/**
 * `claude-sonnet-5` — the current-generation Sonnet model (per the Anthropic
 * API model table, checked at the time TAPS-4.1 was implemented rather than
 * hardcoded from memory). Sonnet, not Opus: structured extraction from
 * already-supplied text is a "single call, well-specified schema" workload,
 * not the kind of open-ended reasoning task that needs the top-tier model —
 * see docs/adr/011-ai-quiz-generation.md.
 */
const ANTHROPIC_MODEL = 'claude-sonnet-5';

/**
 * `gpt-5.6-terra` — checked against the live OpenAI model reference at the
 * time TAPS-4.2 was implemented (GA 2026-07-09), not hardcoded from training
 * data. Terra is OpenAI's mid ("balances intelligence and cost") tier of the
 * GPT-5.6 family — chosen for the same reason `claude-sonnet-5` was chosen
 * over Opus above: this is a single-call, well-specified-schema extraction
 * task, not open-ended multi-step reasoning that would justify the flagship
 * `gpt-6-astra` tier. See docs/adr/012-ai-provider-fallback.md.
 */
const OPENAI_MODEL = 'gpt-5.6-terra';

/** A minimal chat turn — the common shape both SDKs' message params accept. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * One provider capable of turning a chat-style prompt into the model's raw
 * text response. `AIService` owns building the prompt and the retry-once-
 * on-malformed-JSON/validation logic identically for whichever provider
 * implements this interface — the abstraction is drawn here, at "send these
 * messages, get raw text back", specifically so both providers are forced
 * to normalize to the exact same downstream shape before validation ever
 * sees their output. See docs/adr/012-ai-provider-fallback.md.
 */
export interface QuizGenerationProvider {
  callModel(messages: ChatMessage[]): Promise<string>;
}

export class AnthropicQuizProvider implements QuizGenerationProvider {
  private readonly logger = new Logger(AnthropicQuizProvider.name);
  // Zero-arg constructor: resolves ANTHROPIC_API_KEY from the environment
  // (apps/api/.env / the Fly secret) — never hardcode a key here.
  private readonly client = new Anthropic();

  async callModel(messages: ChatMessage[]): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (error) {
      // Deliberately not caught/swallowed further up: an Anthropic API
      // failure (auth, billing, rate limit, model-not-found, ...) must
      // surface loudly. `error` is preserved as `cause` specifically so
      // `AIService`'s fallback classifier (below) can inspect the real
      // Anthropic SDK error, not just this wrapper's message string.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Anthropic API call failed: ${message}`);
      throw new AIQuizGenerationError(`Anthropic API call failed: ${message}`, error);
    }

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
}

export class OpenAIQuizProvider implements QuizGenerationProvider {
  private readonly logger = new Logger(OpenAIQuizProvider.name);
  // Zero-arg constructor: resolves OPENAI_API_KEY from the environment
  // (apps/api/.env / the Fly secret) — never hardcode a key here, same
  // convention as AnthropicQuizProvider above.
  private readonly client = new OpenAI();

  async callModel(messages: ChatMessage[]): Promise<string> {
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        // GPT-5.x-family chat models reject the older `max_tokens` in favor
        // of `max_completion_tokens` — see docs/adr/012-ai-provider-fallback.md.
        max_completion_tokens: 8192,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI API call failed: ${message}`);
      throw new AIQuizGenerationError(`OpenAI API call failed: ${message}`, error);
    }

    return response.choices[0]?.message?.content ?? '';
  }
}

// Anthropic's documented error taxonomy (platform.claude.com/docs/en/api/errors,
// checked while writing this) reserves a distinct 402 `billing_error` for
// "an issue with your billing or payment information". A real, live call
// made while verifying this story (see docs/adr/012-ai-provider-fallback.md)
// against a real, real-money-billed-but-credit-exhausted account instead
// came back as a plain 400 `invalid_request_error` whose *message* — not its
// `type` — says "Your credit balance is too low to access the Anthropic
// API.". Anthropic's own community has flagged this same inconsistency (a
// credit-balance failure surfacing with the generic 400/invalid_request_error
// shape rather than a distinguishable type), so the `type` field alone
// cannot be trusted to tell a credit/billing failure apart from a genuinely
// malformed request — this regex is the only currently-reliable signal.
const CREDIT_BALANCE_MESSAGE = /credit balance/i;

/**
 * Whether an Anthropic failure is eligible for a same-request OpenAI
 * fallback, per `docs/adr/012-ai-provider-fallback.md`'s exact policy table:
 *
 * - a billing/credit error — the documented `billing_error` type (402), OR
 *   the credit-balance-exhausted 400 actually observed live (see the note
 *   above) — → eligible
 * - a rate limit (429 `rate_limit_error`) → eligible
 * - a 5xx server error → eligible
 * - an `authentication_error`, any other malformed/invalid-request failure
 *   (400 `invalid_request_error` that isn't the credit-balance case, 403,
 *   404, ...), or a non-API-error (e.g. a network failure) → NOT eligible
 *
 * `cause` is expected to be whatever `AnthropicQuizProvider.callModel` set as
 * an `AIQuizGenerationError`'s `cause` — i.e. the raw thrown value from the
 * Anthropic SDK call, not the wrapper error itself. A same-provider
 * malformed-JSON-after-retry failure (TAPS-4.1's contract, left unchanged)
 * never reaches this function at all: `AIService.extractQuestionsWithFallback`
 * only calls it when the caught error is an `AIQuizGenerationError` that
 * actually carries a `cause`.
 */
export function isAnthropicFallbackEligible(cause: unknown): boolean {
  if (!(cause instanceof AnthropicAPIError)) {
    return false;
  }
  if (cause.type === 'authentication_error') {
    return false;
  }
  if (cause.type === 'billing_error' || CREDIT_BALANCE_MESSAGE.test(cause.message)) {
    return true;
  }
  if (cause.status === 429) {
    return true;
  }
  return typeof cause.status === 'number' && cause.status >= 500;
}
