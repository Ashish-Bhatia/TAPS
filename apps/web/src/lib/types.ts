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
