import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared query-param shape for every paginated public list endpoint
 * (TAPS-3.1). `transform: true` on the global ValidationPipe (main.ts) runs
 * class-transformer first, so `@Type(() => Number)` coerces the raw query
 * string ("2") to a number before class-validator's `@IsInt` checks it.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
