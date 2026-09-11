import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { PastPaper } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { ListPastPapersQueryDto } from './dto/list-past-papers-query.dto.js';
import { PublicPastPapersService } from './public-past-papers.service.js';

/**
 * Unauthenticated, read-only (TAPS-3.8), single-record lookup by id (no
 * slug-like identifier on PastPaper) — see
 * docs/adr/006-public-content-api-shape.md and
 * docs/adr/013-post-category-field-and-content-endpoints.md.
 */
@Controller('public/past-papers')
export class PublicPastPapersController {
  constructor(private readonly pastPapersService: PublicPastPapersService) {}

  @Get()
  findAll(@Query() query: ListPastPapersQueryDto): Promise<Paginated<PastPaper>> {
    return this.pastPapersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PastPaper> {
    const pastPaper = await this.pastPapersService.findOne(id);
    if (!pastPaper) {
      throw new NotFoundException(`PastPaper ${id} not found`);
    }
    return pastPaper;
  }
}
