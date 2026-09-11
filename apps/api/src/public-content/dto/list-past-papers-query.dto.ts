import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination-query.dto.js';

/**
 * TAPS-3.8. examBoardId/subject/year are all optional, mirroring the
 * PastPaper(examBoardId, subject, year) composite index
 * (docs/adr/004-content-schema-design.md) — the natural admin/browse
 * filters. One DTO, one @Query() — see ListPostsQueryDto for why that
 * matters.
 */
export class ListPastPapersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  examBoardId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}
