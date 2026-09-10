import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';

export interface SearchResult {
  type: 'post' | 'exam-board';
  id: string;
  title: string;
  // A Post's parent ExamBoard, if it has one — null for a general/
  // non-board post, and always null for an 'exam-board' result. Lets
  // apps/web link a post result somewhere real (its board's hub page)
  // without apps/web needing its own public post-detail page yet.
  examBoardId: string | null;
  rank: number;
}

// Raw row shapes $queryRaw returns before we reshape them — `rank` comes
// back as Prisma's arbitrary-precision Decimal type for a `real`/`float8`
// SQL column, not a plain JS number.
interface SearchRow {
  type: 'post' | 'exam-board';
  id: string;
  title: string;
  examBoardId: string | null;
  rank: Prisma.Decimal | number;
}
interface CountRow {
  count: bigint;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto): Promise<Paginated<SearchResult>> {
    const { q, page, pageSize } = query;

    // websearch_to_tsquery (not plainto_tsquery) accepts arbitrary user
    // input — quotes, "OR", "-word" exclusions — without ever throwing a
    // syntax error, unlike to_tsquery. Only *published* posts are
    // searchable, matching the public-read rule everywhere else
    // (docs/adr/006-public-content-api-shape.md).
    const [rows, [{ count }]] = await Promise.all([
      this.prisma.$queryRaw<SearchRow[]>`
        SELECT * FROM (
          SELECT 'post' AS type, p.id, p.title, p."examBoardId", ts_rank(p."searchVector", websearch_to_tsquery('english', ${q})) AS rank
          FROM posts p
          WHERE p."searchVector" @@ websearch_to_tsquery('english', ${q})
            AND p."publishedAt" IS NOT NULL
            AND p."publishedAt" <= now()
          UNION ALL
          SELECT 'exam-board' AS type, e.id, e.name AS title, NULL::text AS "examBoardId", ts_rank(e."searchVector", websearch_to_tsquery('english', ${q})) AS rank
          FROM exam_boards e
          WHERE e."searchVector" @@ websearch_to_tsquery('english', ${q})
        ) combined
        ORDER BY rank DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT count(*) FROM (
          SELECT p.id FROM posts p
          WHERE p."searchVector" @@ websearch_to_tsquery('english', ${q})
            AND p."publishedAt" IS NOT NULL
            AND p."publishedAt" <= now()
          UNION ALL
          SELECT e.id FROM exam_boards e
          WHERE e."searchVector" @@ websearch_to_tsquery('english', ${q})
        ) combined
      `,
    ]);

    const total = Number(count);
    return {
      data: rows.map((row) => ({ ...row, rank: Number(row.rank) })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
