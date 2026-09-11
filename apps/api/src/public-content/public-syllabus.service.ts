import { Injectable } from '@nestjs/common';
import { Prisma, Syllabus } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListSyllabusQueryDto } from './dto/list-syllabus-query.dto.js';

/**
 * Unauthenticated, read-only (TAPS-3.8) — mirrors PublicPostsService's
 * shape/pagination, see docs/adr/006-public-content-api-shape.md and
 * docs/adr/013-post-category-field-and-content-endpoints.md.
 */
@Injectable()
export class PublicSyllabusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListSyllabusQueryDto): Promise<Paginated<Syllabus>> {
    const { page, pageSize, examBoardId, subject } = query;
    const where = this.filterWhere(examBoardId, subject);

    const [data, total] = await Promise.all([
      this.prisma.syllabus.findMany({
        where,
        orderBy: [{ subject: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.syllabus.count({ where }),
    ]);

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  findOne(id: string): Promise<Syllabus | null> {
    return this.prisma.syllabus.findUnique({ where: { id } });
  }

  private filterWhere(examBoardId?: string, subject?: string): Prisma.SyllabusWhereInput {
    return {
      ...(examBoardId ? { examBoardId } : {}),
      ...(subject ? { subject } : {}),
    };
  }
}
