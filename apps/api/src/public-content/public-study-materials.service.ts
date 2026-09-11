import { Injectable } from '@nestjs/common';
import { Prisma, StudyMaterial } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListStudyMaterialsQueryDto } from './dto/list-study-materials-query.dto.js';

/**
 * Unauthenticated, read-only (TAPS-3.8) — mirrors PublicPostsService's
 * shape/pagination, see docs/adr/006-public-content-api-shape.md and
 * docs/adr/013-post-category-field-and-content-endpoints.md. No
 * examBoardId filter — StudyMaterial has no such field (subject-keyed
 * only, per the ADR).
 */
@Injectable()
export class PublicStudyMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListStudyMaterialsQueryDto): Promise<Paginated<StudyMaterial>> {
    const { page, pageSize, subject } = query;
    const where = this.filterWhere(subject);

    const [data, total] = await Promise.all([
      this.prisma.studyMaterial.findMany({
        where,
        orderBy: [{ subject: 'asc' }, { title: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.studyMaterial.count({ where }),
    ]);

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  findOne(id: string): Promise<StudyMaterial | null> {
    return this.prisma.studyMaterial.findUnique({ where: { id } });
  }

  private filterWhere(subject?: string): Prisma.StudyMaterialWhereInput {
    return {
      ...(subject ? { subject } : {}),
    };
  }
}
