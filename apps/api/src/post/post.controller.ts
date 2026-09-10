import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Post } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { PostService } from './post.service.js';

/**
 * Admin-only CMS endpoints (TAPS-2.3) — see the same note on
 * ExamBoardController: this is the admin/CMS surface, not a public read API.
 */
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @HttpPost()
  create(@Body() dto: CreatePostDto): Promise<Post> {
    return this.postService.create(dto);
  }

  @Get()
  findAll(@Query('examBoardId') examBoardId?: string): Promise<Post[]> {
    return this.postService.findAll(examBoardId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Post> {
    const post = await this.postService.findOne(id);
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    return post;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto): Promise<Post> {
    return this.postService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.postService.remove(id);
  }
}
