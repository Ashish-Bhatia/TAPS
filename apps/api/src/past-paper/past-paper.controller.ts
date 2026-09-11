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
  Query,
  UseGuards,
} from '@nestjs/common';
import { PastPaper } from '@prisma/client';
import { AIService } from '../ai/ai.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreatePastPaperDto } from './dto/create-past-paper.dto.js';
import { UpdatePastPaperDto } from './dto/update-past-paper.dto.js';
import { PastPaperService } from './past-paper.service.js';

export interface GenerateQuizResponse {
  count: number;
}

/**
 * Admin-only CMS endpoints (TAPS-2.3's pattern, applied to `PastPaper` by
 * TAPS-4.0) — same admin/CMS-only scope note as `ExamBoardController`. The
 * `PastPaper` this returns from `create`/`findOne`/etc. carries
 * `extractionStatus` (and `extractedText` once `DONE`) straight from
 * Prisma, so the text-extraction outcome is visible in the response with
 * no extra wiring.
 */
@Controller('past-papers')
@UseGuards(JwtAuthGuard)
export class PastPaperController {
  constructor(
    private readonly pastPaperService: PastPaperService,
    private readonly aiService: AIService,
  ) {}

  @Post()
  create(@Body() dto: CreatePastPaperDto): Promise<PastPaper> {
    return this.pastPaperService.create(dto);
  }

  @Get()
  findAll(@Query('examBoardId') examBoardId?: string): Promise<PastPaper[]> {
    return this.pastPaperService.findAll(examBoardId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PastPaper> {
    const pastPaper = await this.pastPaperService.findOne(id);
    if (!pastPaper) {
      throw new NotFoundException(`PastPaper ${id} not found`);
    }
    return pastPaper;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePastPaperDto): Promise<PastPaper> {
    return this.pastPaperService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.pastPaperService.remove(id);
  }

  /**
   * TAPS-4.1: runs `AIService.generateQuizFromPaper` against this paper's
   * extracted text and reports how many `QuizQuestion` rows it created.
   * Question-bank generation only — this does not return the questions
   * themselves (fetch via a future `QuizQuestion` read endpoint); returning
   * a bare count keeps this admin action's response small regardless of
   * how many questions a paper yields.
   */
  @Post(':id/generate-quiz')
  async generateQuiz(@Param('id') id: string): Promise<GenerateQuizResponse> {
    const created = await this.aiService.generateQuizFromPaper(id);
    return { count: created.length };
  }
}
