import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Syllabus } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { ListSyllabusQueryDto } from './dto/list-syllabus-query.dto.js';
import { PublicSyllabusService } from './public-syllabus.service.js';

/**
 * Unauthenticated, read-only (TAPS-3.8) — the public counterpart to
 * whatever admin Syllabus CRUD exists, following PublicExamBoardsController
 * exactly (no auth guard, single-record lookup by id since Syllabus has no
 * slug-like identifier) — see docs/adr/006-public-content-api-shape.md and
 * docs/adr/013-post-category-field-and-content-endpoints.md.
 */
@Controller('public/syllabus')
export class PublicSyllabusController {
  constructor(private readonly syllabusService: PublicSyllabusService) {}

  @Get()
  findAll(@Query() query: ListSyllabusQueryDto): Promise<Paginated<Syllabus>> {
    return this.syllabusService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Syllabus> {
    const syllabus = await this.syllabusService.findOne(id);
    if (!syllabus) {
      throw new NotFoundException(`Syllabus ${id} not found`);
    }
    return syllabus;
  }
}
