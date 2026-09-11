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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreatePastPaperDto } from './dto/create-past-paper.dto.js';
import { UpdatePastPaperDto } from './dto/update-past-paper.dto.js';
import { PastPaperService } from './past-paper.service.js';

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
  constructor(private readonly pastPaperService: PastPaperService) {}

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
}
