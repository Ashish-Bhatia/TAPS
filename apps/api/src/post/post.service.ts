import { Injectable } from '@nestjs/common';
import { Post } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePostDto): Promise<Post> {
    return this.prisma.post.create({
      data: {
        ...dto,
        publishedAt: dto.publishedAt !== undefined ? new Date(dto.publishedAt) : undefined,
      },
    });
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

  update(id: string, dto: UpdatePostDto): Promise<Post> {
    return this.prisma.post.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.publishedAt !== undefined ? new Date(dto.publishedAt) : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }
}
