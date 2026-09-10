import { Injectable } from '@nestjs/common';
import { ExamBoard } from '@prisma/client';
import { Paginated, PaginationQueryDto } from '../common/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PublicExamBoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationQueryDto): Promise<Paginated<ExamBoard>> {
    const { page, pageSize } = pagination;
    const [data, total] = await Promise.all([
      this.prisma.examBoard.findMany({
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.examBoard.count(),
    ]);

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  findOne(id: string): Promise<ExamBoard | null> {
    return this.prisma.examBoard.findUnique({ where: { id } });
  }
}
