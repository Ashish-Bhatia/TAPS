import { HttpException, HttpStatus, UnprocessableEntityException } from '@nestjs/common';

/**
 * Thrown by `AIService.generateQuizFromPaper` when the target `PastPaper`'s
 * `extractionStatus` isn't `DONE` yet — there's no `extractedText` to
 * generate a quiz from (still `PENDING`, or ingestion previously `FAILED`).
 * 422, not 400: the request itself (a valid `pastPaperId`) is well-formed,
 * the paper just isn't ready for this operation.
 */
export class PastPaperNotExtractedError extends UnprocessableEntityException {
  constructor(pastPaperId: string, extractionStatus: string) {
    super(
      `PastPaper ${pastPaperId} has no extracted text to generate a quiz from ` +
        `(extractionStatus: ${extractionStatus}, expected DONE)`,
    );
  }
}

/**
 * Thrown by `AIService.generateQuizFromPaper` when the model's response
 * still isn't valid, schema-conforming JSON after one retry. Per
 * `docs/adr/011-ai-quiz-generation.md`: fail loudly rather than insert
 * unvalidated rows — 502 (Bad Gateway) because the failure is the upstream
 * AI provider returning something unusable, not a client input error.
 *
 * Also thrown (with `cause` set to the raw SDK error) when a provider's API
 * call itself fails for any reason — including the fallback-ineligible cases
 * from `docs/adr/012-ai-provider-fallback.md` (Anthropic `authentication_error`
 * or a malformed/invalid request), which propagate out of
 * `AIService.generateQuizFromPaper` as this same error, unwrapped, exactly as
 * TAPS-4.1 defined it.
 */
export class AIQuizGenerationError extends HttpException {
  constructor(message: string, cause?: unknown) {
    super(`AI quiz generation failed: ${message}`, HttpStatus.BAD_GATEWAY, { cause });
  }
}

/**
 * Thrown by `AIService.generateQuizFromPaper` (TAPS-4.2) when Anthropic fails
 * in a fallback-eligible way (billing/credit error, rate limit, or a 5xx) and
 * the OpenAI fallback attempt *also* fails — i.e. every provider is
 * exhausted. Carries both underlying errors (never swallows either) so the
 * real cause of whichever provider failed is still visible. See
 * `docs/adr/012-ai-provider-fallback.md`.
 */
export class AIAllProvidersFailedError extends HttpException {
  constructor(anthropicError: unknown, openaiError: unknown) {
    const describe = (error: unknown): string =>
      error instanceof Error ? error.message : String(error);
    super(
      `AI quiz generation failed on every provider — ` +
        `Anthropic: ${describe(anthropicError)} | OpenAI: ${describe(openaiError)}`,
      HttpStatus.BAD_GATEWAY,
      { cause: { anthropicError, openaiError } },
    );
  }
}
