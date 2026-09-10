import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Post } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import { PublicPostsService } from './public-posts.service.js';

/**
 * Unauthenticated, read-only (TAPS-3.1), published posts only — see
 * PublicExamBoardsController and docs/adr/006-public-content-api-shape.md.
 */
@Controller('public/posts')
export class PublicPostsController {
  constructor(private readonly postsService: PublicPostsService) {}

  // Single DTO carrying every accepted query field (page, pageSize,
  // examBoardId), bound via one @Query() — see
  // dto/list-posts-query.dto.ts for why that matters (a real bug, found
  // live, when this used a second, separate @Query('examBoardId') param).
  @Get()
  findAll(@Query() query: ListPostsQueryDto): Promise<Paginated<Post>> {
    return this.postsService.findAll(query, query.examBoardId);
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
