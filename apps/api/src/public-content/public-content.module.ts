import { Module } from '@nestjs/common';
import { PublicExamBoardsController } from './public-exam-boards.controller.js';
import { PublicExamBoardsService } from './public-exam-boards.service.js';
import { PublicPostsController } from './public-posts.controller.js';
import { PublicPostsService } from './public-posts.service.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  controllers: [PublicExamBoardsController, PublicPostsController, SearchController],
  providers: [PublicExamBoardsService, PublicPostsService, SearchService],
})
export class PublicContentModule {}
