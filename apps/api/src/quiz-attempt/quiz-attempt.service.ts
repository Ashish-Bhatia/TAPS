import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuizQuestion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// How many QuizQuestion rows a single attempt draws from the board's
// question bank. 10 is a plain, defensible default for a short practice
// quiz (long enough to give a meaningful weak-topic signal, short enough to
// finish in one sitting) — there's no adaptive-length requirement in this
// story's acceptance criteria, so a fixed constant is deliberately chosen
// over a configurable/adaptive count. See docs/adr/015-quiz-attempt-data-shape.md.
export const QUESTION_COUNT = 10;

// What start() returns for each question — the same shape as QuizQuestion
// minus correctOption/explanation, which must not reach the client before
// the attempt is submitted.
export type QuizAttemptQuestion = Omit<QuizQuestion, 'correctOption' | 'explanation'>;

export interface StartQuizAttemptResult {
  attemptId: string;
  questions: QuizAttemptQuestion[];
}

export interface SubmittedQuestionResult {
  id: string;
  questionText: string;
  options: string[];
  correctOption: number;
  explanation: string;
  selectedOption: number | null;
  isCorrect: boolean;
}

export interface SubmitQuizAttemptResult {
  score: number;
  totalQuestions: number;
  weakTopics: Record<string, number>;
  questions: SubmittedQuestionResult[];
}

// One completed attempt, as listed by getMyAttempts() — deliberately just
// the fields TAPS-5.3's dashboard needs (id/examBoardId/score/weakTopics/
// completedAt), not the full QuizAttempt row (questionIds/answers are
// submission-time detail the dashboard has no use for).
export interface MyQuizAttemptSummary {
  id: string;
  examBoardId: string;
  score: number;
  weakTopics: Record<string, number>;
  completedAt: Date;
}

// One point on the accuracy-trend line: score/totalQuestions for a single
// attempt, in the order the attempts were completed (oldest first — see
// getMyAttempts() doc comment for why this is the opposite order from
// `attempts`).
export interface AccuracyTrendPoint {
  attemptId: string;
  completedAt: Date;
  score: number;
  totalQuestions: number;
  accuracy: number;
}

export interface MyQuizAttemptsResult {
  attempts: MyQuizAttemptSummary[];
  accuracyTrend: AccuracyTrendPoint[];
  weakTopicHeatmap: Record<string, number>;
}

@Injectable()
export class QuizAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only aggregation over a user's completed QuizAttempts (TAPS-5.3) —
   * no new schema, everything here is derived from columns TAPS-5.2 already
   * writes at submit() time. In-progress attempts (completedAt: null) are
   * excluded entirely: an unfinished attempt has no score/weakTopics yet, so
   * it can't contribute to either aggregate below.
   *
   * Shape chosen (the simplest correct one for a dashboard, not the only
   * possible one):
   * - `attempts`: one row per completed attempt, **most recent first**
   *   (completedAt desc) — the natural order for "your attempt history".
   * - `accuracyTrend`: one point per attempt, **oldest first** (completedAt
   *   asc) — the order a trend/line chart needs to read left-to-right as
   *   "improving over time"; reusing `attempts`' order would draw the trend
   *   backwards. `accuracy` is score/totalQuestions (totalQuestions being
   *   that attempt's questionIds.length, since QuizAttempt has no separate
   *   total-questions column) — a 0–1 fraction, not a percentage, so the
   *   caller decides display formatting. totalQuestions is always >= 1 for
   *   a completed attempt: start() 400s before creating one if the board
   *   has zero questions.
   * - `weakTopicHeatmap`: every attempt's `weakTopics` tally (per-topic
   *   incorrect-answer counts, see QuizAttemptService.submit) summed
   *   together into one map — a single merged view of "what this user gets
   *   wrong most, across their whole history", rather than making the
   *   caller re-merge `attempts[].weakTopics` client-side. Topics with zero
   *   incorrect answers across every attempt are simply absent, matching
   *   the per-attempt `weakTopics` convention.
   */
  async getMyAttempts(userId: string): Promise<MyQuizAttemptsResult> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
    });

    const summaries: MyQuizAttemptSummary[] = attempts.map((attempt) => ({
      id: attempt.id,
      examBoardId: attempt.examBoardId,
      // Non-null by construction: submit() always sets score/weakTopics/
      // completedAt together (quiz-attempt.service.ts submit()), and the
      // query above only selects attempts with completedAt set.
      score: attempt.score ?? 0,
      weakTopics: (attempt.weakTopics as Record<string, number> | null) ?? {},
      completedAt: attempt.completedAt as Date,
    }));

    const accuracyTrend: AccuracyTrendPoint[] = [...attempts]
      .sort((a, b) => (a.completedAt as Date).getTime() - (b.completedAt as Date).getTime())
      .map((attempt) => {
        const totalQuestions = attempt.questionIds.length;
        const score = attempt.score ?? 0;
        return {
          attemptId: attempt.id,
          completedAt: attempt.completedAt as Date,
          score,
          totalQuestions,
          accuracy: totalQuestions === 0 ? 0 : score / totalQuestions,
        };
      });

    const weakTopicHeatmap: Record<string, number> = {};
    for (const summary of summaries) {
      for (const [topic, count] of Object.entries(summary.weakTopics)) {
        weakTopicHeatmap[topic] = (weakTopicHeatmap[topic] ?? 0) + count;
      }
    }

    return { attempts: summaries, accuracyTrend, weakTopicHeatmap };
  }

  async start(userId: string, examBoardId: string): Promise<StartQuizAttemptResult> {
    const examBoard = await this.prisma.examBoard.findUnique({ where: { id: examBoardId } });
    if (!examBoard) {
      throw new NotFoundException(`ExamBoard ${examBoardId} not found`);
    }

    // QuizQuestion has no direct examBoardId — it belongs to a PastPaper,
    // which belongs to an ExamBoard (see apps/api/prisma/schema.prisma) — so
    // "questions for a board" is a filter through that relation. Ordered by
    // createdAt so a fixed run (e.g. in tests) is deterministic; randomizing
    // selection is left to a future adaptive-selection story
    // (05-ARCHITECTURE.md §5's getAdaptiveQuiz) rather than built here.
    const questions = await this.prisma.quizQuestion.findMany({
      where: { pastPaper: { examBoardId } },
      orderBy: { createdAt: 'asc' },
      take: QUESTION_COUNT,
    });

    if (questions.length === 0) {
      throw new BadRequestException(
        `No quiz questions are available yet for ExamBoard ${examBoardId}`,
      );
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        examBoardId,
        questionIds: questions.map((q) => q.id),
      },
    });

    return {
      attemptId: attempt.id,
      questions: questions.map((question) => this.sanitizeQuestion(question)),
    };
  }

  // Strips correctOption/explanation — the two fields a client must not see
  // before an attempt is submitted. Listed explicitly (rather than a
  // destructuring omit) so adding a new QuizQuestion column is a compiler
  // error here until this list is deliberately updated, instead of it
  // silently leaking through.
  private sanitizeQuestion(question: QuizQuestion): QuizAttemptQuestion {
    return {
      id: question.id,
      pastPaperId: question.pastPaperId,
      subject: question.subject,
      topic: question.topic,
      difficulty: question.difficulty,
      questionText: question.questionText,
      options: question.options,
      aiGenerated: question.aiGenerated,
      reviewedByAdmin: question.reviewedByAdmin,
      aiProvider: question.aiProvider,
      createdAt: question.createdAt,
    };
  }

  async submit(
    userId: string,
    attemptId: string,
    answers: Record<string, number>,
  ): Promise<SubmitQuizAttemptResult> {
    const attempt = await this.prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      throw new NotFoundException(`QuizAttempt ${attemptId} not found`);
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException('This quiz attempt does not belong to you');
    }
    if (attempt.completedAt) {
      throw new ConflictException('This quiz attempt has already been submitted');
    }

    // questionIds was fixed at start() time; fetch those exact rows rather
    // than re-selecting, so a submission is always scored against the same
    // questions the user was actually shown.
    const questions = await this.prisma.quizQuestion.findMany({
      where: { id: { in: attempt.questionIds } },
    });
    const questionsById = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    const weakTopics: Record<string, number> = {};
    const results: SubmittedQuestionResult[] = [];

    for (const questionId of attempt.questionIds) {
      const question = questionsById.get(questionId);
      if (!question) {
        // A QuizQuestion referenced by this attempt was deleted after
        // start() — an admin-side edge case, not a client error. Skip it
        // rather than failing the whole submission.
        continue;
      }

      const selectedOption = answers[questionId] ?? null;
      const isCorrect = selectedOption === question.correctOption;
      if (isCorrect) {
        score += 1;
      } else {
        weakTopics[question.topic] = (weakTopics[question.topic] ?? 0) + 1;
      }

      results.push({
        id: question.id,
        questionText: question.questionText,
        options: question.options,
        correctOption: question.correctOption,
        explanation: question.explanation,
        selectedOption,
        isCorrect,
      });
    }

    await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        answers,
        score,
        weakTopics,
        completedAt: new Date(),
      },
    });

    return {
      score,
      totalQuestions: results.length,
      weakTopics,
      questions: results,
    };
  }
}
