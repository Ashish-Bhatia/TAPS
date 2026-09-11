import { apiFetchAuthed } from './auth';

// Mirrors apps/api's TAPS-5.3 shapes (docs/api/quiz-attempts.md's
// GET /quiz-attempts/me) and apps/web/src/lib/types.ts's equivalent
// QuizAttemptSummary/AccuracyTrendPoint/MyQuizAttemptsResult — duplicated
// here rather than imported, same reasoning as every other shared shape in
// this app (no packages/types workspace yet, TAPS-1.12).

export interface QuizAttemptSummary {
  id: string;
  examBoardId: string;
  score: number;
  weakTopics: Record<string, number>;
  completedAt: string;
}

export interface AccuracyTrendPoint {
  attemptId: string;
  completedAt: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
}

export interface MyQuizAttemptsResult {
  attempts: QuizAttemptSummary[];
  accuracyTrend: AccuracyTrendPoint[];
  weakTopicHeatmap: Record<string, number>;
}

/**
 * Used by the progress dashboard screen (TAPS-6.4, app/dashboard.tsx).
 * Reuses src/lib/auth.ts's apiFetchAuthed (a plain authed GET) — no new
 * fetch wrapper needed, unlike TAPS-6.3's quiz.ts, which needed authed
 * POSTs apiFetchAuthed doesn't cover.
 */
export async function getMyQuizAttempts(token: string): Promise<MyQuizAttemptsResult> {
  return apiFetchAuthed<MyQuizAttemptsResult>('/quiz-attempts/me', token);
}
