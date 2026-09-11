// Mirrors apps/api's public API response shapes (docs/api/public-content.md).
// apps/web has no shared-types workspace yet (packages/types is still an
// empty placeholder — TAPS-1.12), so these are duplicated here deliberately
// rather than importing from apps/api's Prisma-generated types, which would
// couple the web app's build to the API's dependency graph.

export type ExamBoardType = 'TEACHING' | 'TET';

export interface ExamBoard {
  id: string;
  name: string;
  type: ExamBoardType;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  examBoardId: string | null;
  type: 'NOTIFICATION' | 'ARTICLE';
  // Free-form, nullable classification (TAPS-3.8) — e.g. "exam-pattern",
  // "eligibility" — see the public posts endpoint's `category` filter in
  // docs/api/public-content.md.
  category: string | null;
  title: string;
  slug: string;
  body: string;
  heroImage: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Syllabus/PastPaper/StudyMaterial (TAPS-3.8's public endpoints, TAPS-3.6's
// /exam-boards/[id]/syllabus, /previous-papers, /study-materials pages).

export interface Syllabus {
  id: string;
  examBoardId: string;
  subject: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PastPaper {
  id: string;
  examBoardId: string;
  subject: string;
  year: number;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

// No examBoardId — StudyMaterial is organized by subject only, not tied to
// a specific exam board (docs/adr/013-post-category-field-and-content-endpoints.md).
export interface StudyMaterial {
  id: string;
  subject: string;
  title: string;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchResult {
  type: 'post' | 'exam-board';
  id: string;
  title: string;
  examBoardId: string | null;
  rank: number;
}
