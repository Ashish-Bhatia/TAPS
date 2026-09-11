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

@Injectable()
export class QuizAttemptService {
  constructor(private readonly prisma: PrismaService) {}

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
