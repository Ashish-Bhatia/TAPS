import { Injectable } from '@nestjs/common';
import { PastPaper, Prisma } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListPastPapersQueryDto } from './dto/list-past-papers-query.dto.js';

/**
 * Unauthenticated, read-only (TAPS-3.8) — mirrors PublicPostsService's
 * shape/pagination, see docs/adr/006-public-content-api-shape.md and
 * docs/adr/013-post-category-field-and-content-endpoints.md.
 */
@Injectable()
export class PublicPastPapersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPastPapersQueryDto): Promise<Paginated<PastPaper>> {
    const { page, pageSize, examBoardId, subject, year } = query;
    const where = this.filterWhere(examBoardId, subject, year);

    const [data, total] = await Promise.all([
      this.prisma.pastPaper.findMany({
        where,
        orderBy: [{ year: 'desc' }, { subject: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pastPaper.count({ where }),
    ]);

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  findOne(id: string): Promise<PastPaper | null> {
    return this.prisma.pastPaper.findUnique({ where: { id } });
  }

  private filterWhere(
    examBoardId?: string,
    subject?: string,
    year?: number,
  ): Prisma.PastPaperWhereInput {
    return {
      ...(examBoardId ? { examBoardId } : {}),
      ...(subject ? { subject } : {}),
      ...(year ? { year } : {}),
    };
  }
}
