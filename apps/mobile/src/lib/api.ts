import type { ExamBoard, Paginated, Post } from './types';

// EXPO_PUBLIC_-prefixed vars are inlined into the client bundle at build
// time (Expo's client-env convention — see docs/adr for the web
// NEXT_PUBLIC_ equivalent used by apps/web/src/lib/api.ts's apiUrl()). Falls
// back to the local Android emulator's loopback alias for the host
// machine's `apps/api` dev server (10.0.2.2, not localhost — the emulator
// runs in its own network namespace, so `localhost` there resolves to the
// emulator itself, not the host).
export function apiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';
}

/**
 * Thin wrapper around fetch for the public content API
 * (docs/api/public-content.md), mirroring apps/web/src/lib/api.ts's
 * apiFetch. No `cache`/`next` options here — those are Next.js-specific
 * fetch extensions with no equivalent (or need) in React Native's fetch.
 */
async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Used by the exam board list screen (TAPS-6.1, app/index.tsx).
 */
export async function getExamBoards(): Promise<ExamBoard[]> {
  const page = await apiFetch<Paginated<ExamBoard>>('/public/exam-boards?pageSize=100');
  return page.data;
}

/**
 * Used by the exam board detail screen (TAPS-6.1, app/exam-boards/[id].tsx).
 * `null` specifically means "no such exam board" (API returned 404), which
 * the caller renders as a not-found state — same convention as
 * apps/web/src/lib/api.ts's getExamBoard.
 */
export async function getExamBoard(id: string): Promise<ExamBoard | null> {
  const response = await fetch(`${apiUrl()}/public/exam-boards/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} /public/exam-boards/${id}`);
  }
  return response.json() as Promise<ExamBoard>;
}

/**
 * Used by the exam board detail screen (TAPS-6.1) to list a board's
 * published posts, same endpoint/shape as apps/web's getPostsByExamBoard.
 */
export async function getPostsByExamBoard(examBoardId: string): Promise<Post[]> {
  const page = await apiFetch<Paginated<Post>>(
    `/public/posts?examBoardId=${examBoardId}&pageSize=100`,
  );
  return page.data;
}
