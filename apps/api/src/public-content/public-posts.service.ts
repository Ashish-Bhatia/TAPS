import { Injectable } from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
import { Paginated, PaginationQueryDto } from '../common/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PublicPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationQueryDto,
    examBoardId?: string,
    category?: string,
  ): Promise<Paginated<Post>> {
    const { page, pageSize } = pagination;
    const where = this.publishedWhere(examBoardId, category);

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  findOne(slug: string): Promise<Post | null> {
    return this.prisma.post.findFirst({ where: { slug, ...this.publishedWhere() } });
  }

  // Only ever surface published posts here — a draft's slug is not a secret,
  // but it also isn't meant to be publicly readable yet just because
  // someone guesses or enumerates it. Admin-only PostController (TAPS-2.3)
  // is the only place drafts are visible.
  private publishedWhere(examBoardId?: string, category?: string): Prisma.PostWhereInput {
    return {
      publishedAt: { not: null, lte: new Date() },
      ...(examBoardId ? { examBoardId } : {}),
      ...(category ? { category } : {}),
    };
  }
}
