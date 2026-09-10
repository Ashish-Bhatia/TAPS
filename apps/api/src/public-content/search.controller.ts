import { Controller, Get, Query } from '@nestjs/common';
import { Paginated } from '../common/pagination-query.dto.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SearchResult, SearchService } from './search.service.js';

/**
 * Unauthenticated (TAPS-3.4), Postgres full-text search across published
 * Posts and ExamBoards — see docs/adr/009-full-text-search.md.
 */
@Controller('public/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchQueryDto): Promise<Paginated<SearchResult>> {
    return this.searchService.search(query);
  }
}
