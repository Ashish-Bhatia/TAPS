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
  Post,
  UseGuards,
} from '@nestjs/common';
import { ExamBoard } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateExamBoardDto } from './dto/create-exam-board.dto.js';
import { UpdateExamBoardDto } from './dto/update-exam-board.dto.js';
import { ExamBoardService } from './exam-board.service.js';

/**
 * Admin-only CMS endpoints (TAPS-2.3) — every route requires a valid admin
 * JWT (see POST /auth/login). Public read endpoints for the web app are a
 * separate, later story (see docs/backlog/BACKLOG.md — EPIC 3, not yet
 * broken into stories) — this controller is the admin/CMS surface, not the
 * public content API.
 */
@Controller('exam-boards')
@UseGuards(JwtAuthGuard)
export class ExamBoardController {
  constructor(private readonly examBoardService: ExamBoardService) {}

  @Post()
  create(@Body() dto: CreateExamBoardDto): Promise<ExamBoard> {
    return this.examBoardService.create(dto);
  }

  @Get()
  findAll(): Promise<ExamBoard[]> {
    return this.examBoardService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ExamBoard> {
    const examBoard = await this.examBoardService.findOne(id);
    if (!examBoard) {
      throw new NotFoundException(`ExamBoard ${id} not found`);
    }
    return examBoard;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExamBoardDto): Promise<ExamBoard> {
    return this.examBoardService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.examBoardService.remove(id);
  }
}
