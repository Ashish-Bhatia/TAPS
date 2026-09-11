// Mirrors apps/api's public API response shapes (docs/api/public-content.md),
// same as apps/web/src/lib/types.ts. apps/mobile has no shared-types
// workspace to import from either (packages/types is still an empty
// placeholder — TAPS-1.12), so this is duplicated deliberately rather than
// importing from apps/web or apps/api's own types.
//
// Only the shapes TAPS-6.1 (exam board list/detail) actually uses are
// defined here — Syllabus/PastPaper/StudyMaterial/QuizAttempt/etc. get added
// alongside the mobile screens that consume them (TAPS-6.2–6.4), matching
// how apps/web/src/lib/types.ts grew one story at a time rather than being
// written wholesale up front.

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
  category: string | null;
  title: string;
  slug: string;
  body: string;
  heroImage: string | null;
  publishedAt: string | null;
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
