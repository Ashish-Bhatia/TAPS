import type {
  ExamBoard,
  MyQuizAttemptsResult,
  Paginated,
  PastPaper,
  Post,
  SearchResult,
  StudyMaterial,
  Syllabus,
} from './types';

// Same var read both server- and client-side: it's a public base URL, not a
// secret, so there's no downside to the NEXT_PUBLIC_ prefix exposing it to
// the browser bundle too (TAPS-3.4's search box needs it client-side).
// Falls back to the apps/api dev default (see apps/api/.env.example) so
// local dev works without an env var set, matching the pattern
// apps/api/src/main.ts already uses for ALLOWED_ORIGIN.
// Exported (not just used internally) so the auth route handlers
// (src/app/api/auth/{login,register}/route.ts, TAPS-5.0.5) can build the
// same apps/api URL for their own server-to-server login/register calls,
// rather than duplicating this fallback.
export function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
}

/**
 * Cache tag names for TAPS-3.7's tag-based revalidation
 * (docs/adr/019-tag-based-cache-revalidation.md). There's no shared package
 * between apps/web and apps/api in this repo (a plain HTTP boundary, per
 * 05-ARCHITECTURE.md — no `packages/*` workspace is actually used today), so
 * apps/api's ExamBoardService/PostService construct these exact same
 * strings independently when calling this app's `/api/revalidate` route.
 * Keep both sides in sync by hand if this naming ever changes.
 */
const EXAM_BOARDS_TAG = ['exam-boards'];
function examBoardTag(id: string): string {
  return `exam-board-${id}`;
}
function postsTag(examBoardId: string): string {
  return `posts-${examBoardId}`;
}

/**
 * Thin wrapper around fetch for the public content API
 * (docs/api/public-content.md). Callers decide their own error handling —
 * this only centralizes the base URL and JSON parsing.
 *
 * Default (`tags` omitted): `cache: 'no-store'` — deliberately uncached, not
 * `next: { revalidate: N }`. The revalidate-based approach was tried first
 * and found live (via TAPS-3.3's exam hub page, not caught by mocked unit
 * tests) to serve a stale/empty cached response that survived full
 * dev-server restarts and a fully cleared `.next` directory — an
 * admin-published post never appeared on its board's hub page. Traced to
 * Next.js's Data Cache, not this app's code (confirmed: calling the same
 * functions outside Next's request context, via a plain Node script,
 * returned correct data every time). Switching to `cache: 'no-store'` fixed
 * it immediately and reliably. See docs/adr/007-nav-data-sourcing.md's
 * follow-up note.
 *
 * When `tags` IS passed: `cache: 'force-cache'` + `next: { tags }` instead —
 * TAPS-3.7's opt-in tagged caching for genuinely static/shared content (see
 * docs/adr/019-tag-based-cache-revalidation.md), invalidated on-demand by
 * `apps/api`'s admin write endpoints calling this app's own
 * `/api/revalidate` route rather than a blind time window (the exact kind
 * of caching the paragraph above already found unsafe once). Caching is
 * opt-in per call site deliberately — `search()`, for example, must never
 * pass `tags` here.
 */
export async function apiFetch<T>(path: string, tags?: string[]): Promise<T> {
  const response = await fetch(
    `${apiUrl()}${path}`,
    tags ? { cache: 'force-cache', next: { tags } } : { cache: 'no-store' },
  );
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
 *
 * Tagged `exam-boards` (TAPS-3.7) — apps/api's ExamBoard admin
 * create/update/delete endpoints revalidate this tag on write, so the nav
 * stays live without round-tripping to apps/api on every single page.
 */
export async function getExamBoardsForNav(): Promise<ExamBoard[]> {
  try {
    const page = await apiFetch<Paginated<ExamBoard>>(
      '/public/exam-boards?pageSize=100',
      EXAM_BOARDS_TAG,
    );
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
 *
 * Tagged `exam-board-<id>` (TAPS-3.7) — apps/api's ExamBoard admin
 * update/delete endpoints revalidate this specific board's tag on write.
 */
export async function getExamBoard(id: string): Promise<ExamBoard | null> {
  const response = await fetch(`${apiUrl()}/public/exam-boards/${id}`, {
    cache: 'force-cache',
    next: { tags: [examBoardTag(id)] },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} /public/exam-boards/${id}`);
  }
  return response.json() as Promise<ExamBoard>;
}

/**
 * `category` is optional and additive to `examBoardId` (TAPS-3.8's
 * `Post.category` filter, docs/api/public-content.md) — used by the exam
 * hub's Exam Pattern/Eligibility sub-pages (TAPS-3.6) to get genuinely
 * distinct per-board content instead of the pre-TAPS-3.8 `filterArticles`
 * client-side type filter (both pages rendered the same `ARTICLE`-typed
 * list). Omitted entirely by the hub page itself, which wants every post
 * for a board regardless of category.
 *
 * Tagged `posts-<examBoardId>` (TAPS-3.7) — apps/api's Post admin
 * create/update/delete endpoints revalidate this tag (keyed off the post's
 * own `examBoardId`, not the `category` query param) on write, so every
 * variant of this call (hub page, Exam Pattern, Eligibility) sharing one
 * board's posts is invalidated together.
 */
export async function getPostsByExamBoard(examBoardId: string, category?: string): Promise<Post[]> {
  const params = new URLSearchParams({ examBoardId, pageSize: '100' });
  if (category) {
    params.set('category', category);
  }
  const page = await apiFetch<Paginated<Post>>(`/public/posts?${params.toString()}`, [
    postsTag(examBoardId),
  ]);
  return page.data;
}

/**
 * Used by the exam hub's Syllabus sub-page (TAPS-3.6/TAPS-3.8).
 * `examBoardId` is a required filter here (unlike `getPostsByExamBoard`'s
 * optional one) since every caller of this function is board-scoped.
 */
export async function getSyllabusByExamBoard(examBoardId: string): Promise<Syllabus[]> {
  const page = await apiFetch<Paginated<Syllabus>>(
    `/public/syllabus?examBoardId=${examBoardId}&pageSize=100`,
  );
  return page.data;
}

/**
 * Used by the exam hub's Previous Papers sub-page (TAPS-3.6/TAPS-3.8).
 */
export async function getPastPapersByExamBoard(examBoardId: string): Promise<PastPaper[]> {
  const page = await apiFetch<Paginated<PastPaper>>(
    `/public/past-papers?examBoardId=${examBoardId}&pageSize=100`,
  );
  return page.data;
}

/**
 * Used by the exam hub's Study Material sub-page (TAPS-3.6/TAPS-3.8).
 * Deliberately NOT board-scoped and takes no `examBoardId` parameter:
 * `StudyMaterial` has no `examBoardId` field at all (confirmed against the
 * schema — it's organized by `subject` only, see
 * docs/adr/013-post-category-field-and-content-endpoints.md), so there is
 * no real filter to apply here. `/exam-boards/[id]/study-materials`
 * fetches this same full catalog for every board and says so in its note,
 * rather than inventing a board relationship the data model doesn't have.
 */
export async function getAllStudyMaterials(): Promise<StudyMaterial[]> {
  const page = await apiFetch<Paginated<StudyMaterial>>('/public/study-materials?pageSize=100');
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

/**
 * Distinguishes "apps/api rejected the bearer token itself" from any other
 * failure, so callers (the dashboard page) can tell a stale/expired
 * session apart from a genuine API outage — see
 * src/lib/session.ts's `clearSessionAndRedirectToLogin`.
 */
export class UnauthorizedApiError extends Error {}

/**
 * Like `apiFetch`, but for TAPS-5.0.5's authenticated, per-user endpoints:
 * forwards the session's JWT (read from apps/web's own httpOnly cookie by
 * the caller, never from a cookie sent to apps/api itself — see ADR
 * 016-web-session-cookie-strategy.md) as a normal `Authorization: Bearer`
 * header, exactly as any other client of `UserJwtAuthGuard` would
 * (docs/api/user-auth.md).
 *
 * `cache: 'no-store'`, not `force-cache`/a bare `next.revalidate` — same
 * reasoning docs/architecture/web-app.md's "Guidance for EPIC 5's upcoming
 * user-specific dashboard/quiz-attempt pages" already flagged before this
 * fetch existed: caching a request carrying an `authorization` header
 * risks Next's persistent fetch cache serving one user's response back to
 * another.
 */
async function apiFetchAuthed<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
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
 * Used by the progress dashboard page (`TAPS-5.3`'s web half, unblocked by
 * `TAPS-5.0.5`) — `docs/api/quiz-attempts.md`'s `GET /quiz-attempts/me`.
 * Does NOT fail soft (unlike `getExamBoardsForNav`): the dashboard's whole
 * purpose is this data, so a real API error should surface as an error,
 * and a `401` specifically should send the caller back through
 * `clearSessionAndRedirectToLogin()` (`UnauthorizedApiError`, above).
 */
export async function getMyQuizAttempts(token: string): Promise<MyQuizAttemptsResult> {
  return apiFetchAuthed<MyQuizAttemptsResult>('/quiz-attempts/me', token);
}
