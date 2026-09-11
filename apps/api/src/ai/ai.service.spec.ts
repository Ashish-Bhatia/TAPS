import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AIProvider, ExtractionStatus } from '@prisma/client';
import Anthropic, { APIError } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AIAllProvidersFailedError,
  AIQuizGenerationError,
  PastPaperNotExtractedError,
} from './ai.errors.js';
import { AIService } from './ai.service.js';

// The Anthropic and OpenAI clients are both mocked throughout this file —
// every test here covers the parse/validation/persistence/fallback logic
// around them, per TAPS-4.1's and TAPS-4.2's test plans. The one real, live
// call against both APIs is a manual smoke test (see
// docs/adr/012-ai-provider-fallback.md), not a unit test — it can't be,
// since it depends on real ANTHROPIC_API_KEY/OPENAI_API_KEY values. Named
// exports (Anthropic.APIError and friends) are preserved from the real
// module so tests can construct authentic, correctly-typed SDK errors for
// the fallback classifier to inspect — only each package's default client
// export is replaced.
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  return { ...actual, default: vi.fn() };
});
vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>();
  return { ...actual, default: vi.fn() };
});

function anthropicResponse(text: string): Pick<Anthropic.Message, 'content'> {
  return { content: [{ type: 'text', text, citations: null }] };
}

function openaiResponse(content: string): Pick<OpenAI.Chat.Completions.ChatCompletion, 'choices'> {
  return { choices: [{ message: { content } }] } as OpenAI.Chat.Completions.ChatCompletion;
}

/** Builds a real, correctly-typed Anthropic SDK error via the SDK's own factory. */
function anthropicApiError(status: number, type: string, message: string): APIError {
  return APIError.generate(
    status,
    { type: 'error', error: { type, message } },
    message,
    new Headers(),
  );
}

describe('AIService', () => {
  let service: AIService;
  let anthropicCreateMock: ReturnType<typeof vi.fn>;
  let openaiCreateMock: ReturnType<typeof vi.fn>;

  const prismaMock = {
    pastPaper: { findUnique: vi.fn() },
    quizQuestion: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const pastPaper = {
    id: 'pp-1',
    subject: 'Maths',
    extractionStatus: ExtractionStatus.DONE,
    extractedText: 'Q1. What is 2+2? (a) 3 (b) 4 (c) 5 (d) 6. Answer: b',
  };

  const validQuestion = {
    question: 'What is 2+2?',
    options: ['3', '4', '5', '6'],
    correctOption: 1,
    explanation: '2 + 2 = 4',
    subject: 'Maths',
    topic: 'Arithmetic',
    difficulty: 'EASY',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    anthropicCreateMock = vi.fn();
    openaiCreateMock = vi.fn();
    // Both services do `new Anthropic()` / `new OpenAI()` themselves, so the
    // mocked constructors' return values are what each provider's `client`
    // resolves to. Only `messages.create` / `chat.completions.create` are
    // exercised by the code under test — casting the partial stub to each
    // SDK's real (much larger) type is the accepted way to stub an external
    // SDK client in this codebase's tests.
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { messages: { create: anthropicCreateMock } };
    });
    (OpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return { chat: { completions: { create: openaiCreateMock } } };
    });
    prismaMock.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    prismaMock.quizQuestion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'q1', ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  it('throws NotFoundException when the PastPaper does not exist, without calling either provider', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(null);

    await expect(service.generateQuizFromPaper('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(anthropicCreateMock).not.toHaveBeenCalled();
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it('throws PastPaperNotExtractedError when extractionStatus is not DONE', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue({
      ...pastPaper,
      extractionStatus: ExtractionStatus.PENDING,
      extractedText: null,
    });

    await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
      PastPaperNotExtractedError,
    );
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it('throws PastPaperNotExtractedError when extractionStatus is FAILED', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue({
      ...pastPaper,
      extractionStatus: ExtractionStatus.FAILED,
      extractedText: null,
    });

    await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
      PastPaperNotExtractedError,
    );
  });

  it('persists a validated question on the happy path, aiProvider: ANTHROPIC, overriding subject with the PastPaper record rather than the model output', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse(JSON.stringify([{ ...validQuestion, subject: 'Something Else Entirely' }])),
    );

    const result = await service.generateQuizFromPaper('pp-1');

    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(openaiCreateMock).not.toHaveBeenCalled();
    expect(prismaMock.quizQuestion.create).toHaveBeenCalledWith({
      data: {
        pastPaperId: 'pp-1',
        subject: 'Maths',
        topic: 'Arithmetic',
        difficulty: 'EASY',
        questionText: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctOption: 1,
        explanation: '2 + 2 = 4',
        aiProvider: AIProvider.ANTHROPIC,
      },
    });
    expect(result).toHaveLength(1);
  });

  it('strips a ```json code fence before parsing', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse('```json\n' + JSON.stringify([validQuestion]) + '\n```'),
    );

    const result = await service.generateQuizFromPaper('pp-1');

    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('persists every extracted question from one response, all in a single transaction', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
    const second = { ...validQuestion, question: 'What is 3+3?', topic: 'Arithmetic II' };
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse(JSON.stringify([validQuestion, second])),
    );

    const result = await service.generateQuizFromPaper('pp-1');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.quizQuestion.create).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('rejects a response that is valid JSON but not an array', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
    anthropicCreateMock.mockResolvedValue(anthropicResponse(JSON.stringify(validQuestion)));

    await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
      AIQuizGenerationError,
    );
  });

  describe('TAPS-4.2 fallback policy', () => {
    // Branch 1: a fallback-eligible Anthropic failure retries against OpenAI,
    // and on success the rows are persisted with aiProvider: OPENAI.
    //
    // The first case matches what a real, live call actually returned while
    // verifying this story (see docs/adr/012-ai-provider-fallback.md): a
    // plain 400 `invalid_request_error` whose *message* — not its `type` —
    // says the credit balance is too low, not the cleanly-typed 402
    // `billing_error` Anthropic's docs describe. Both shapes must classify
    // as fallback-eligible.
    it.each<[string, number, string, string]>([
      [
        '400 invalid_request_error with a credit-balance message (observed live)',
        400,
        'invalid_request_error',
        'Your credit balance is too low to access the Anthropic API.',
      ],
      ['402 billing_error (as documented)', 402, 'billing_error', 'Anthropic billing_error'],
      ['429 rate limit', 429, 'rate_limit_error', 'Anthropic rate_limit_error'],
      ['a 5xx server error', 500, 'api_error', 'Anthropic api_error'],
    ])(
      'falls back to OpenAI on Anthropic %s, and persists aiProvider: OPENAI',
      async (_label, status, type, message) => {
        prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
        anthropicCreateMock.mockRejectedValue(anthropicApiError(status, type, message));
        openaiCreateMock.mockResolvedValueOnce(openaiResponse(JSON.stringify([validQuestion])));

        const result = await service.generateQuizFromPaper('pp-1');

        expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
        expect(openaiCreateMock).toHaveBeenCalledTimes(1);
        const [[{ data }]] = prismaMock.quizQuestion.create.mock.calls as [
          [{ data: Record<string, unknown> }],
        ];
        expect(data.aiProvider).toBe(AIProvider.OPENAI);
        expect(result).toHaveLength(1);
      },
    );

    // Branch 2a: authentication_error is NOT fallback-eligible — the
    // existing (TAPS-4.1) typed error propagates as-is, OpenAI is never
    // called.
    it('does not fall back on an Anthropic authentication_error — throws as-is', async () => {
      prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
      anthropicCreateMock.mockRejectedValue(
        anthropicApiError(401, 'authentication_error', 'API key is invalid.'),
      );

      await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
        AIQuizGenerationError,
      );
      expect(openaiCreateMock).not.toHaveBeenCalled();
      expect(prismaMock.quizQuestion.create).not.toHaveBeenCalled();
    });

    // Branch 2b: a malformed/invalid-request error (400) is likewise NOT
    // fallback-eligible.
    it('does not fall back on an Anthropic invalid_request_error — throws as-is', async () => {
      prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
      anthropicCreateMock.mockRejectedValue(
        anthropicApiError(
          400,
          'invalid_request_error',
          'messages: at least one message is required',
        ),
      );

      await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
        AIQuizGenerationError,
      );
      expect(openaiCreateMock).not.toHaveBeenCalled();
    });

    // Branch 2c (regression, TAPS-4.1's unchanged contract): a
    // same-provider malformed-JSON retry is not a fallback trigger either —
    // it's not even an API-call failure, so `cause` is undefined and the
    // classifier's default (no fallback) applies.
    it('retries once on malformed JSON same-provider (unchanged TAPS-4.1 behavior), and succeeds if the retry is valid', async () => {
      prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
      anthropicCreateMock
        .mockResolvedValueOnce(anthropicResponse('this is not json at all'))
        .mockResolvedValueOnce(anthropicResponse(JSON.stringify([validQuestion])));

      const result = await service.generateQuizFromPaper('pp-1');

      expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
      expect(openaiCreateMock).not.toHaveBeenCalled();
      const retryCallArgs = anthropicCreateMock.mock.calls[1][0] as {
        messages: Anthropic.MessageParam[];
      };
      const lastMessage = retryCallArgs.messages.at(-1);
      expect(lastMessage?.role).toBe('user');
      expect(lastMessage?.content).toContain('ONLY');
      expect(result).toHaveLength(1);
    });

    it('fails loudly with AIQuizGenerationError (no fallback) when both same-provider attempts are malformed JSON', async () => {
      prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
      anthropicCreateMock.mockResolvedValue(anthropicResponse('still not json'));

      await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
        AIQuizGenerationError,
      );
      expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
      expect(openaiCreateMock).not.toHaveBeenCalled();
      expect(prismaMock.quizQuestion.create).not.toHaveBeenCalled();
    });

    it('retries once on a schema-invalid response (e.g. correctOption out of range), then fails loudly with no fallback', async () => {
      prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
      const outOfRange = { ...validQuestion, correctOption: 99 };
      anthropicCreateMock
        .mockResolvedValueOnce(anthropicResponse(JSON.stringify([outOfRange])))
        .mockResolvedValueOnce(anthropicResponse(JSON.stringify([outOfRange])));

      await expect(service.generateQuizFromPaper('pp-1')).rejects.toBeInstanceOf(
        AIQuizGenerationError,
      );
      expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
      expect(openaiCreateMock).not.toHaveBeenCalled();
      expect(prismaMock.quizQuestion.create).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // Branch 3: both providers fail — AIAllProvidersFailedError, reporting
    // both underlying errors without swallowing either.
    it('throws AIAllProvidersFailedError reporting both errors when Anthropic is fallback-eligible but OpenAI also fails', async () => {
      prismaMock.pastPaper.findUnique.mockResolvedValue(pastPaper);
      anthropicCreateMock.mockRejectedValue(
        anthropicApiError(400, 'invalid_request_error', 'Your credit balance is too low'),
      );
      const openaiFailure = new Error('OpenAI: insufficient_quota');
      openaiCreateMock.mockRejectedValue(openaiFailure);

      const error = await service.generateQuizFromPaper('pp-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AIAllProvidersFailedError);
      const allFailed = error as AIAllProvidersFailedError;
      expect(allFailed.message).toContain('credit balance is too low');
      expect(allFailed.message).toContain('insufficient_quota');
      expect(prismaMock.quizQuestion.create).not.toHaveBeenCalled();
    });
  });
});
