import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination-query.dto.js';

/**
 * TAPS-3.8. Both filters are optional, matching Post's examBoardId filter
 * (docs/adr/006-public-content-api-shape.md's addendum) — declared on this
 * one DTO, bound via a single @Query(), for the same forbidNonWhitelisted
 * reason documented on ListPostsQueryDto.
 */
export class ListSyllabusQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  examBoardId?: string;

  @IsOptional()
  @IsString()
  subject?: string;
}
