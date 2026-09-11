import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { StudyMaterial } from '@prisma/client';
import { Paginated } from '../common/pagination-query.dto.js';
import { ListStudyMaterialsQueryDto } from './dto/list-study-materials-query.dto.js';
import { PublicStudyMaterialsService } from './public-study-materials.service.js';

/**
 * Unauthenticated, read-only (TAPS-3.8), single-record lookup by id (no
 * slug-like identifier on StudyMaterial) — see
 * docs/adr/006-public-content-api-shape.md and
 * docs/adr/013-post-category-field-and-content-endpoints.md.
 */
@Controller('public/study-materials')
export class PublicStudyMaterialsController {
  constructor(private readonly studyMaterialsService: PublicStudyMaterialsService) {}

  @Get()
  findAll(@Query() query: ListStudyMaterialsQueryDto): Promise<Paginated<StudyMaterial>> {
    return this.studyMaterialsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<StudyMaterial> {
    const studyMaterial = await this.studyMaterialsService.findOne(id);
    if (!studyMaterial) {
      throw new NotFoundException(`StudyMaterial ${id} not found`);
    }
    return studyMaterial;
  }
}
