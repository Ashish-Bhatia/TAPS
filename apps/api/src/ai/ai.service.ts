import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIProvider, ExtractionStatus, QuizDifficulty, QuizQuestion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AIAllProvidersFailedError,
  AIQuizGenerationError,
  PastPaperNotExtractedError,
} from './ai.errors.js';
import {
  AnthropicQuizProvider,
  type ChatMessage,
  isAnthropicFallbackEligible,
  OpenAIQuizProvider,
  type QuizGenerationProvider,
} from './ai.providers.js';
import { chunkPastPaperText, dedupeQuestions } from './paper-chunking.js';

const DIFFICULTIES = new Set<string>(['EASY', 'MEDIUM', 'HARD']);

/** The shape the model is asked to return per extracted question. */
interface RawQuizQuestion {
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
  subject: string;
  topic: string;
  difficulty: string;
}

/**
 * All AI calls go through this module (05-ARCHITECTURE.md §5) — model or
 * provider changes never touch controllers or frontend code.
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly anthropicProvider = new AnthropicQuizProvider();
  private readonly openaiProvider = new OpenAIQuizProvider();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads `pastPaperId`'s `extractedText`, has an AI provider extract
   * question/answer pairs from it tagged by subject/topic/difficulty,
   * validates the response strictly, and persists each validated question
   * as a `QuizQuestion` row (`aiGenerated: true`, `reviewedByAdmin: false`
   * per 08-AI-FEATURES-SPEC.md §5's guardrail — never presented as
   * admin-reviewed until an admin actually reviews it). `aiProvider` records
   * whichever provider actually produced each persisted row — see
   * `extractQuestionsWithFallback` and `docs/adr/012-ai-provider-fallback.md`.
   *
   * TAPS-4.5: `extractedText` is first split into page-boundary-aware,
   * overlapping chunks (`chunkPastPaperText`) — a full-size paper sent as
   * one completion exhausts `gpt-5.6-terra`'s fixed completion-token budget
   * on hidden reasoning before emitting any visible output
   * (`finish_reason: length`); see
   * `docs/adr/025-quiz-generation-paper-chunking.md`. Each chunk goes
   * through the exact same fallback/retry pipeline as before, one chunk at
   * a time; the deliberate overlap between chunks means the same question
   * can come back from two chunks, so results are deduped
   * (`dedupeQuestions`) before persistence. A paper small enough to fit in
   * one chunk makes exactly one call, identical to pre-TAPS-4.5 behavior.
   *
   * Throws `NotFoundException` if `pastPaperId` doesn't exist,
   * `PastPaperNotExtractedError` if `extractionStatus` isn't `DONE`,
   * `AIQuizGenerationError` if Anthropic fails in a non-fallback-eligible way
   * (auth/malformed-request) or if a chunk's output still isn't valid JSON
   * matching the expected shape after one same-provider retry, and
   * `AIAllProvidersFailedError` if Anthropic fails in a fallback-eligible way
   * and the OpenAI fallback also fails for any one chunk — this never writes
   * partial or unvalidated rows to the database: chunk generation runs to
   * completion (or throws) entirely before the single persistence
   * transaction at the end.
   */
  async generateQuizFromPaper(pastPaperId: string): Promise<QuizQuestion[]> {
    const pastPaper = await this.prisma.pastPaper.findUnique({ where: { id: pastPaperId } });
    if (!pastPaper) {
      throw new NotFoundException(`PastPaper ${pastPaperId} not found`);
    }
    if (pastPaper.extractionStatus !== ExtractionStatus.DONE || !pastPaper.extractedText) {
      throw new PastPaperNotExtractedError(pastPaperId, pastPaper.extractionStatus);
    }

    const chunks = chunkPastPaperText(pastPaper.extractedText);
    if (chunks.length > 1) {
      this.logger.log(
        `PastPaper ${pastPaperId}: extractedText split into ${chunks.length} chunks for quiz generation`,
      );
    }

    // Sequential, not Promise.all: this project's scale/budget doesn't need
    // concurrent provider calls, and sequential keeps per-paper generation
    // well clear of either provider's rate limits — see
    // docs/adr/025-quiz-generation-paper-chunking.md.
    const tagged: { question: RawQuizQuestion; provider: AIProvider }[] = [];
    for (const chunk of chunks) {
      const { questions, provider } = await this.extractQuestionsWithFallback(chunk);
      for (const question of questions) {
        tagged.push({ question, provider });
      }
    }

    const deduped = dedupeQuestions(tagged);

    // A single transaction: either every deduped question is persisted, or
    // none are — a partial write would leave a silently incomplete question
    // bank with no signal that generation actually failed midway.
    return this.prisma.$transaction(
      deduped.map(({ question: q, provider }) =>
        this.prisma.quizQuestion.create({
          data: {
            pastPaperId,
            // The known PastPaper.subject is ground truth; the model's own
            // `subject` guess is intentionally not trusted for this field
            // (see docs/adr/011-ai-quiz-generation.md) — only topic/
            // difficulty, which the paper record doesn't carry, come from
            // the model's output.
            subject: pastPaper.subject,
            topic: q.topic,
            difficulty: q.difficulty as QuizDifficulty,
            questionText: q.question,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            aiProvider: provider,
          },
        }),
      ),
    );
  }

  /**
   * TAPS-4.2's fallback policy (docs/adr/012-ai-provider-fallback.md), exact
   * and not to be extended with additional cases:
   *
   * - Anthropic succeeds → return its questions, `aiProvider: ANTHROPIC`.
   * - Anthropic fails in a fallback-eligible way (billing/credit error, rate
   *   limit, or a 5xx — see `isAnthropicFallbackEligible`) → retry the exact
   *   same request against OpenAI. On success, `aiProvider: OPENAI`.
   * - Anthropic fails any other way (`authentication_error`, or a
   *   malformed/invalid request — including a same-provider
   *   malformed-JSON-after-retry failure) → NO fallback; the error
   *   propagates as-is.
   * - Anthropic fails a fallback-eligible way AND the OpenAI attempt also
   *   fails → throws `AIAllProvidersFailedError` with both underlying
   *   errors.
   */
  private async extractQuestionsWithFallback(
    extractedText: string,
  ): Promise<{ questions: RawQuizQuestion[]; provider: AIProvider }> {
    try {
      const questions = await this.extractQuestions(this.anthropicProvider, extractedText);
      return { questions, provider: AIProvider.ANTHROPIC };
    } catch (anthropicError) {
      const cause =
        anthropicError instanceof AIQuizGenerationError ? anthropicError.cause : undefined;
      if (!isAnthropicFallbackEligible(cause)) {
        throw anthropicError;
      }

      const causeMessage = cause instanceof Error ? cause.message : String(cause);
      this.logger.warn(
        `Anthropic call failed in a fallback-eligible way (${causeMessage}); retrying against OpenAI.`,
      );

      try {
        const questions = await this.extractQuestions(this.openaiProvider, extractedText);
        return { questions, provider: AIProvider.OPENAI };
      } catch (openaiError) {
        throw new AIAllProvidersFailedError(anthropicError, openaiError);
      }
    }
  }

  /**
   * Calls `provider` once, and — only if that response isn't valid,
   * schema-conforming JSON — once more with the failure fed back, per
   * TAPS-4.1's "reject and retry once on malformed output, then fail
   * loudly" contract. Same-provider, unchanged by TAPS-4.2: this never
   * switches providers mid-retry — only `extractQuestionsWithFallback`
   * switches providers, and only between one provider's whole attempt
   * (both calls) failing and the other provider's first call starting.
   * Never returns unvalidated data.
   */
  private async extractQuestions(
    provider: QuizGenerationProvider,
    extractedText: string,
  ): Promise<RawQuizQuestion[]> {
    const userPrompt = this.buildPrompt(extractedText);
    const messages: ChatMessage[] = [{ role: 'user', content: userPrompt }];

    const firstAttempt = await provider.callModel(messages);
    const firstResult = this.parseAndValidate(firstAttempt);
    if (firstResult) {
      return firstResult;
    }

    this.logger.warn('First quiz-generation response was malformed JSON; retrying once.');
    messages.push(
      { role: 'assistant', content: firstAttempt },
      {
        role: 'user',
        content:
          'That was not valid JSON matching the required shape. Reply with ONLY a JSON ' +
          'array of question objects, no markdown fences, no commentary, no trailing text.',
      },
    );

    const secondAttempt = await provider.callModel(messages);
    const secondResult = this.parseAndValidate(secondAttempt);
    if (secondResult) {
      return secondResult;
    }

    throw new AIQuizGenerationError(
      'model output was not valid, schema-conforming JSON after one retry',
    );
  }

  private buildPrompt(extractedText: string): string {
    return (
      'You are extracting quiz questions from a past exam paper for an exam-prep app. ' +
      'From the exam paper text below, extract every self-contained question/answer pair ' +
      'you can find, and return them as a JSON array. Each array item must be an object ' +
      'with exactly these fields:\n' +
      '  "question": the question text (string)\n' +
      '  "options": an array of the answer choices as strings (at least 2)\n' +
      '  "correctOption": the 0-indexed position of the correct answer in "options" (integer)\n' +
      '  "explanation": a short explanation of why that answer is correct (string)\n' +
      '  "subject": the subject this question belongs to (string)\n' +
      '  "topic": the specific topic/chapter within that subject (string)\n' +
      '  "difficulty": one of "EASY", "MEDIUM", or "HARD"\n\n' +
      'Do not invent questions that are not actually in the source text. Reply with ONLY ' +
      'the JSON array — no markdown code fences, no explanation, no other text.\n\n' +
      `Exam paper text:\n${extractedText}`
    );
  }

  /**
   * Returns the validated questions, or `null` if `raw` fails to
   * parse/validate. An empty array (`[]`) is a valid result, not a failure:
   * TAPS-4.5's per-chunk generation means a single call can legitimately
   * cover a chunk with no extractable questions at all (e.g. a closing
   * chunk that's mostly exam-hall conduct instructions, per the real
   * `PastPaper cmtyqyy0z0001sahpuyhz0v24` — see
   * `docs/audits/2026-09-13-followup.md`'s `extractedText` deep-dive)
   * — that's a genuine "nothing here" answer, not malformed output that
   * should burn the one same-provider retry `extractQuestions` allows.
   */
  private parseAndValidate(raw: string): RawQuizQuestion[] | null {
    let parsed: unknown;
    try {
      // Models occasionally wrap JSON in ```json fences despite instructions
      // not to — strip a single pair before parsing rather than failing on it.
      const stripped = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '');
      parsed = JSON.parse(stripped);
    } catch {
      return null;
    }

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.every((item) => this.isValidQuestion(item)) ? parsed : null;
  }

  private isValidQuestion(item: unknown): item is RawQuizQuestion {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const q = item as Record<string, unknown>;
    return (
      typeof q.question === 'string' &&
      q.question.length > 0 &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.every((o) => typeof o === 'string') &&
      typeof q.correctOption === 'number' &&
      Number.isInteger(q.correctOption) &&
      q.correctOption >= 0 &&
      q.correctOption < q.options.length &&
      typeof q.explanation === 'string' &&
      q.explanation.length > 0 &&
      typeof q.subject === 'string' &&
      q.subject.length > 0 &&
      typeof q.topic === 'string' &&
      q.topic.length > 0 &&
      typeof q.difficulty === 'string' &&
      DIFFICULTIES.has(q.difficulty)
    );
  }
}
