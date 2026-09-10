import type { ExamBoard, Paginated, Post, SearchResult } from './types';

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
 *
 * `cache: 'no-store'` — deliberately uncached, not `next: { revalidate:
 * N }`. The revalidate-based approach was tried first and found live (via
 * TAPS-3.3's exam hub page, not caught by mocked unit tests) to serve a
 * stale/empty cached response that survived full dev-server restarts and a
 * fully cleared `.next` directory — an admin-published post never appeared
 * on its board's hub page. Traced to Next.js's Data Cache, not this app's
 * code (confirmed: calling the same functions outside Next's request
 * context, via a plain Node script, returned correct data every time).
 * Switching to `cache: 'no-store'` fixed it immediately and reliably.
 * See docs/adr/007-nav-data-sourcing.md's follow-up note.
 */
export async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, { cache: 'no-store' });
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

/**
 * Used by the exam hub page (TAPS-3.3). Unlike getExamBoardsForNav, this
 * does NOT fail soft to an empty/default value — the hub page's own
 * content genuinely depends on this fetch succeeding, so a real API error
 * (not a 404) should surface as a real error, not render a page that looks
 * fine but is silently missing its content. `null` specifically means "no
 * such exam board" (API returned 404), which the caller turns into Next's
 * notFound() rather than an error page.
 */
export async function getExamBoard(id: string): Promise<ExamBoard | null> {
  const response = await fetch(`${apiUrl()}/public/exam-boards/${id}`, { cache: 'no-store' });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} /public/exam-boards/${id}`);
  }
  return response.json() as Promise<ExamBoard>;
}

export async function getPostsByExamBoard(examBoardId: string): Promise<Post[]> {
  const page = await apiFetch<Paginated<Post>>(
    `/public/posts?examBoardId=${examBoardId}&pageSize=100`,
  );
  return page.data;
}

/**
 * Used by the search page (TAPS-3.4). Like getExamBoard, does NOT fail
 * soft — the search page's entire purpose is this fetch's result, so a
 * real API error should surface as a real error.
 */
export async function search(q: string): Promise<Paginated<SearchResult>> {
  return apiFetch<Paginated<SearchResult>>(`/public/search?q=${encodeURIComponent(q)}`);
}
