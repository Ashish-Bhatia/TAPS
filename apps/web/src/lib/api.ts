import type { ExamBoard, Paginated } from './types';

// Same var read both server- and client-side: it's a public base URL, not a
// secret, so there's no downside to the NEXT_PUBLIC_ prefix exposing it to
// the browser bundle too (TAPS-3.4's search box needs it client-side).
// Falls back to the apps/api dev default (see apps/api/.env.example) so
// local dev works without an env var set, matching the pattern
// apps/api/src/main.ts already uses for ALLOWED_ORIGIN.
function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
}

/**
 * Thin wrapper around fetch for the public content API
 * (docs/api/public-content.md). Callers decide their own error handling —
 * this only centralizes the base URL and JSON parsing.
 */
export async function apiFetch<T>(path: string, revalidateSeconds = 300): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, { next: { revalidate: revalidateSeconds } });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Used by the root layout's nav (every page renders this), so it fails
 * soft: an API outage must not take down the entire site's navigation.
 * Consumers get an empty list rather than a thrown error, and can render
 * accordingly (e.g. dropdown just doesn't populate yet).
 */
export async function getExamBoardsForNav(): Promise<ExamBoard[]> {
  try {
    const page = await apiFetch<Paginated<ExamBoard>>('/public/exam-boards?pageSize=100');
    return page.data;
  } catch (error) {
    console.error('Failed to fetch exam boards for nav:', error);
    return [];
  }
}
