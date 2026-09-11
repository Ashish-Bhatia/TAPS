import { apiUrl } from './api';
import { UnauthorizedApiError } from './auth';

// Mirrors apps/api's quiz-attempt shapes (docs/api/quiz-attempts.md,
// TAPS-5.2). No web equivalent to mirror here — apps/web never built a
// quiz-taking UI, only TAPS-5.1's auth API and TAPS-5.3's read-only
// dashboard consume this data on that side — so these types/functions are
// new, not ported from an existing apps/web file.

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface StartQuizQuestion {
  id: string;
  pastPaperId: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  questionText: string;
  options: string[];
  aiGenerated: boolean;
  reviewedByAdmin: boolean;
  aiProvider: 'ANTHROPIC' | 'OPENAI';
  createdAt: string;
}

export interface StartQuizResult {
  attemptId: string;
  questions: StartQuizQuestion[];
}

export interface SubmittedQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOption: number;
  explanation: string;
  selectedOption: number | null;
  isCorrect: boolean;
}

export interface SubmitQuizResult {
  score: number;
  totalQuestions: number;
  weakTopics: Record<string, number>;
  questions: SubmittedQuestion[];
}

async function authedPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    throw new UnauthorizedApiError(`API request failed: 401 ${path}`);
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

/**
 * `POST /quiz-attempts/start` — up to 10 questions for the given exam
 * board, with `correctOption`/`explanation` stripped (docs/api/quiz-
 * attempts.md). There is no `GET /quiz-attempts/:id` to re-fetch this by
 * id later — the caller (app/quiz/[examBoardId].tsx) holds the returned
 * questions in local state for the life of the attempt.
 */
export async function startQuiz(examBoardId: string, token: string): Promise<StartQuizResult> {
  return authedPost<StartQuizResult>('/quiz-attempts/start', token, { examBoardId });
}

/**
 * `POST /quiz-attempts/:id/submit` — `answers` is questionId → selected
 * option index; a question with no entry is scored incorrect
 * (docs/api/quiz-attempts.md), so callers may submit a partially-answered
 * attempt rather than being forced to answer every question first.
 */
export async function submitQuiz(
  attemptId: string,
  answers: Record<string, number>,
  token: string,
): Promise<SubmitQuizResult> {
  return authedPost<SubmitQuizResult>(`/quiz-attempts/${attemptId}/submit`, token, { answers });
}
