import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination-query.dto.js';

/**
 * TAPS-3.3 bug fix: the original PublicPostsController bound the query
 * string to two separate `@Query()` params — `@Query() pagination:
 * PaginationQueryDto` plus a standalone `@Query('examBoardId')`. The global
 * ValidationPipe's `forbidNonWhitelisted: true` validates the *entire*
 * incoming query object against whichever DTO class is attached to a
 * `@Query()` param, so `?examBoardId=...` got rejected with `400 property
 * examBoardId should not exist` even though a second param existed to
 * consume it — the two decorators don't know about each other. Found live
 * (not by a mocked unit test) while building TAPS-3.3's exam hub page,
 * which is the first real caller of this filter. Fixed by declaring every
 * accepted query field on one DTO, bound via a single `@Query()`.
 */
export class ListPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  examBoardId?: string;

  // TAPS-3.8: optional filter on Post.category (free-form string, not an
  // enum — see docs/adr/013-post-category-field-and-content-endpoints.md).
  // Declared on this same DTO for the same reason examBoardId is — a
  // separate @Query('category') param would hit the exact
  // forbidNonWhitelisted 400 bug documented above.
  @IsOptional()
  @IsString()
  category?: string;
}
