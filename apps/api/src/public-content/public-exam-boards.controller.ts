import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ExamBoard } from '@prisma/client';
import { Paginated, PaginationQueryDto } from '../common/pagination-query.dto.js';
import { PublicExamBoardsService } from './public-exam-boards.service.js';

/**
 * Unauthenticated, read-only (TAPS-3.1) — the counterpart to the admin-only
 * ExamBoardController (TAPS-2.3). Deliberately a separate controller/module
 * rather than adding public routes to the admin one, so the `JwtAuthGuard`
 * on the admin controller can never accidentally apply here (or vice versa)
 * — see docs/adr/006-public-content-api-shape.md.
 */
@Controller('public/exam-boards')
export class PublicExamBoardsController {
  constructor(private readonly examBoardsService: PublicExamBoardsService) {}

  @Get()
  findAll(@Query() pagination: PaginationQueryDto): Promise<Paginated<ExamBoard>> {
    return this.examBoardsService.findAll(pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ExamBoard> {
    const examBoard = await this.examBoardsService.findOne(id);
    if (!examBoard) {
      throw new NotFoundException(`ExamBoard ${id} not found`);
    }
    return examBoard;
  }
}
