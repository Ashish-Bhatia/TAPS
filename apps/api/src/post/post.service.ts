import { Injectable } from '@nestjs/common';
import { Post } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';

// Must match apps/web/src/lib/api.ts's postsTag exactly — no shared package
// between the two apps (see docs/adr/019-tag-based-cache-revalidation.md).
function postsTag(examBoardId: string): string {
  return `posts-${examBoardId}`;
}

@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  async create(dto: CreatePostDto): Promise<Post> {
    const post = await this.prisma.post.create({
      data: {
        ...dto,
        publishedAt: dto.publishedAt !== undefined ? new Date(dto.publishedAt) : undefined,
      },
    });
    if (post.examBoardId) {
      await this.revalidation.revalidate([postsTag(post.examBoardId)]);
    }
    return post;
  }

  findAll(examBoardId?: string): Promise<Post[]> {
    return this.prisma.post.findMany({
      where: examBoardId ? { examBoardId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string): Promise<Post | null> {
    return this.prisma.post.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    // NOTE: if this update moves the post to a different examBoardId, only
    // the NEW board's tag is revalidated here — the old board's cached
    // posts list would need its own fetch-before-update to know the prior
    // value, which this deliberately doesn't add (a caching-optimization
    // edge case, not a correctness one: the old list self-heals once its
    // tag is next revalidated by any other write on that board).
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.publishedAt !== undefined ? new Date(dto.publishedAt) : undefined,
      },
    });
    if (post.examBoardId) {
      await this.revalidation.revalidate([postsTag(post.examBoardId)]);
    }
    return post;
  }

  async remove(id: string): Promise<void> {
    const post = await this.prisma.post.delete({ where: { id } });
    if (post.examBoardId) {
      await this.revalidation.revalidate([postsTag(post.examBoardId)]);
    }
  }
}
