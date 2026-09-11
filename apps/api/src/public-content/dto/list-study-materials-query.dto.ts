import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination-query.dto.js';

/**
 * TAPS-3.8. No examBoardId filter here — unlike Syllabus/PastPaper,
 * StudyMaterial has no examBoardId field at all (it's keyed by subject
 * only, per 05-ARCHITECTURE.md §4 and the Prisma model) — see
 * docs/adr/013-post-category-field-and-content-endpoints.md for why this
 * endpoint's shape deliberately differs from its siblings'.
 */
export class ListStudyMaterialsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  subject?: string;
}
