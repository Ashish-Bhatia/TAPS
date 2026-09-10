import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Post } from '@prisma/client';
import { Paginated, PaginationQueryDto } from '../common/pagination-query.dto.js';
import { PublicPostsService } from './public-posts.service.js';

/**
 * Unauthenticated, read-only (TAPS-3.1), published posts only — see
 * PublicExamBoardsController and docs/adr/006-public-content-api-shape.md.
 */
@Controller('public/posts')
export class PublicPostsController {
  constructor(private readonly postsService: PublicPostsService) {}

  @Get()
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('examBoardId') examBoardId?: string,
  ): Promise<Paginated<Post>> {
    return this.postsService.findAll(pagination, examBoardId);
  }

  // Looked up by slug, not id — slug is Post's public-facing identifier
  // (unique, indexed — see docs/adr/004-content-schema-design.md), matching
  // how a blog/content URL is normally shaped. ExamBoard has no slug field,
  // so its single-record route (above) uses id instead.
  @Get(':slug')
  async findOne(@Param('slug') slug: string): Promise<Post> {
    const post = await this.postsService.findOne(slug);
    if (!post) {
      throw new NotFoundException(`Post "${slug}" not found`);
    }
    return post;
  }
}
