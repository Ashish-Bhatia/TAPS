import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AIProvider, QuizDifficulty } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { QUESTION_COUNT, QuizAttemptService } from './quiz-attempt.service.js';

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    pastPaperId: 'pp-1',
    subject: 'Maths',
    topic: 'Algebra',
    difficulty: QuizDifficulty.MEDIUM,
    questionText: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctOption: 1,
    explanation: '2 + 2 = 4',
    aiGenerated: true,
    reviewedByAdmin: false,
    aiProvider: AIProvider.ANTHROPIC,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('QuizAttemptService', () => {
  let service: QuizAttemptService;
  const prismaMock = {
    examBoard: { findUnique: vi.fn() },
    quizQuestion: { findMany: vi.fn() },
    quizAttempt: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuizAttemptService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<QuizAttemptService>(QuizAttemptService);
  });

  describe('start', () => {
    it('404s when the exam board does not exist', async () => {
      prismaMock.examBoard.findUnique.mockResolvedValue(null);

      await expect(service.start('user-1', 'missing-board')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.quizQuestion.findMany).not.toHaveBeenCalled();
    });

    it('400s when the board has no quiz questions yet', async () => {
      prismaMock.examBoard.findUnique.mockResolvedValue({ id: 'board-1' });
      prismaMock.quizQuestion.findMany.mockResolvedValue([]);

      await expect(service.start('user-1', 'board-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('selects up to QUESTION_COUNT questions filtered through the board relation', async () => {
      prismaMock.examBoard.findUnique.mockResolvedValue({ id: 'board-1' });
      prismaMock.quizQuestion.findMany.mockResolvedValue([makeQuestion()]);
      prismaMock.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      await service.start('user-1', 'board-1');

      expect(prismaMock.quizQuestion.findMany).toHaveBeenCalledWith({
        where: { pastPaper: { examBoardId: 'board-1' } },
        orderBy: { createdAt: 'asc' },
        take: QUESTION_COUNT,
      });
    });

    it('creates the attempt with the selected question ids and returns questions without correctOption/explanation', async () => {
      const q1 = makeQuestion({ id: 'q-1' });
      const q2 = makeQuestion({ id: 'q-2', topic: 'Geometry' });
      prismaMock.examBoard.findUnique.mockResolvedValue({ id: 'board-1' });
      prismaMock.quizQuestion.findMany.mockResolvedValue([q1, q2]);
      prismaMock.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      const result = await service.start('user-1', 'board-1');

      expect(prismaMock.quizAttempt.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', examBoardId: 'board-1', questionIds: ['q-1', 'q-2'] },
      });
      expect(result.attemptId).toBe('attempt-1');
      expect(result.questions).toHaveLength(2);
      for (const question of result.questions) {
        expect(question).not.toHaveProperty('correctOption');
        expect(question).not.toHaveProperty('explanation');
      }
      expect(result.questions[0]).toMatchObject({ id: 'q-1', questionText: 'What is 2 + 2?' });
    });
  });

  describe('submit', () => {
    const inProgressAttempt = {
      id: 'attempt-1',
      userId: 'user-1',
      examBoardId: 'board-1',
      questionIds: ['q-1', 'q-2'],
      completedAt: null,
    };

    it('404s when the attempt does not exist', async () => {
      prismaMock.quizAttempt.findUnique.mockResolvedValue(null);

      await expect(service.submit('user-1', 'missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('403s when the attempt belongs to a different user', async () => {
      prismaMock.quizAttempt.findUnique.mockResolvedValue({
        ...inProgressAttempt,
        userId: 'someone-else',
      });

      await expect(service.submit('user-1', 'attempt-1', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('409s (Conflict) on a second submit of an already-completed attempt', async () => {
      prismaMock.quizAttempt.findUnique.mockResolvedValue({
        ...inProgressAttempt,
        completedAt: new Date('2026-01-01T00:00:00Z'),
      });

      await expect(service.submit('user-1', 'attempt-1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('scores a known answer set correctly and computes the per-topic weak-topic tally', async () => {
      const q1 = makeQuestion({ id: 'q-1', topic: 'Algebra', correctOption: 1 });
      const q2 = makeQuestion({ id: 'q-2', topic: 'Geometry', correctOption: 2 });
      const q3 = makeQuestion({ id: 'q-3', topic: 'Algebra', correctOption: 0 });
      prismaMock.quizAttempt.findUnique.mockResolvedValue({
        ...inProgressAttempt,
        questionIds: ['q-1', 'q-2', 'q-3'],
      });
      prismaMock.quizQuestion.findMany.mockResolvedValue([q1, q2, q3]);
      prismaMock.quizAttempt.update.mockResolvedValue({});

      // q-1 correct (1), q-2 wrong (answered 0, correct is 2), q-3 unanswered.
      const answers = { 'q-1': 1, 'q-2': 0 };
      const result = await service.submit('user-1', 'attempt-1', answers);

      expect(result.score).toBe(1);
      expect(result.totalQuestions).toBe(3);
      // Geometry wrong once, Algebra wrong once (q-3 unanswered still counts
      // as incorrect against its topic).
      expect(result.weakTopics).toEqual({ Geometry: 1, Algebra: 1 });
      expect(result.questions.find((q) => q.id === 'q-1')).toMatchObject({
        isCorrect: true,
        selectedOption: 1,
      });
      expect(result.questions.find((q) => q.id === 'q-3')).toMatchObject({
        isCorrect: false,
        selectedOption: null,
      });
      // Submitted questions expose correctOption/explanation now.
      expect(result.questions[0]).toHaveProperty('correctOption');
      expect(result.questions[0]).toHaveProperty('explanation');

      const [updateCall] = prismaMock.quizAttempt.update.mock.calls[0] as [
        {
          where: { id: string };
          data: { answers: unknown; score: number; weakTopics: unknown; completedAt: Date };
        },
      ];
      expect(updateCall.where).toEqual({ id: 'attempt-1' });
      expect(updateCall.data.answers).toEqual(answers);
      expect(updateCall.data.score).toBe(1);
      expect(updateCall.data.weakTopics).toEqual({ Geometry: 1, Algebra: 1 });
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('getMyAttempts', () => {
    function makeAttempt(overrides: Record<string, unknown> = {}) {
      return {
        id: 'attempt-1',
        userId: 'user-1',
        examBoardId: 'board-1',
        questionIds: ['q-1', 'q-2'],
        answers: {},
        score: 1,
        weakTopics: { Algebra: 1 },
        completedAt: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
      };
    }

    it('queries only completed attempts for the given user, most recent first', async () => {
      prismaMock.quizAttempt.findMany.mockResolvedValue([]);

      await service.getMyAttempts('user-1');

      expect(prismaMock.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
      });
    });

    it('returns an empty result for a user with no completed attempts', async () => {
      prismaMock.quizAttempt.findMany.mockResolvedValue([]);

      const result = await service.getMyAttempts('user-1');

      expect(result).toEqual({ attempts: [], accuracyTrend: [], weakTopicHeatmap: {} });
    });

    it('maps attempts to summaries (id/examBoardId/score/weakTopics/completedAt) in query order', async () => {
      const newer = makeAttempt({
        id: 'attempt-2',
        completedAt: new Date('2026-01-02T00:00:00Z'),
      });
      const older = makeAttempt({
        id: 'attempt-1',
        completedAt: new Date('2026-01-01T00:00:00Z'),
      });
      // Prisma already returns desc order for `attempts` per the query above.
      prismaMock.quizAttempt.findMany.mockResolvedValue([newer, older]);

      const result = await service.getMyAttempts('user-1');

      expect(result.attempts).toEqual([
        {
          id: 'attempt-2',
          examBoardId: 'board-1',
          score: 1,
          weakTopics: { Algebra: 1 },
          completedAt: newer.completedAt,
        },
        {
          id: 'attempt-1',
          examBoardId: 'board-1',
          score: 1,
          weakTopics: { Algebra: 1 },
          completedAt: older.completedAt,
        },
      ]);
    });

    it('builds the accuracy trend oldest-first, independent of the attempts list order', async () => {
      const newer = makeAttempt({
        id: 'attempt-2',
        score: 2,
        questionIds: ['q-1', 'q-2', 'q-3', 'q-4'],
        completedAt: new Date('2026-01-02T00:00:00Z'),
      });
      const older = makeAttempt({
        id: 'attempt-1',
        score: 1,
        questionIds: ['q-1', 'q-2'],
        completedAt: new Date('2026-01-01T00:00:00Z'),
      });
      prismaMock.quizAttempt.findMany.mockResolvedValue([newer, older]);

      const result = await service.getMyAttempts('user-1');

      expect(result.accuracyTrend).toEqual([
        {
          attemptId: 'attempt-1',
          completedAt: older.completedAt,
          score: 1,
          totalQuestions: 2,
          accuracy: 0.5,
        },
        {
          attemptId: 'attempt-2',
          completedAt: newer.completedAt,
          score: 2,
          totalQuestions: 4,
          accuracy: 0.5,
        },
      ]);
    });

    it('merges weakTopics across every attempt into one summed heatmap', async () => {
      const a1 = makeAttempt({ id: 'attempt-1', weakTopics: { Algebra: 2, Geometry: 1 } });
      const a2 = makeAttempt({ id: 'attempt-2', weakTopics: { Algebra: 1, Trigonometry: 3 } });
      prismaMock.quizAttempt.findMany.mockResolvedValue([a1, a2]);

      const result = await service.getMyAttempts('user-1');

      expect(result.weakTopicHeatmap).toEqual({ Algebra: 3, Geometry: 1, Trigonometry: 3 });
    });
  });
});
