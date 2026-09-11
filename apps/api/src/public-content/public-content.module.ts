import { Module } from '@nestjs/common';
import { PublicExamBoardsController } from './public-exam-boards.controller.js';
import { PublicExamBoardsService } from './public-exam-boards.service.js';
import { PublicPastPapersController } from './public-past-papers.controller.js';
import { PublicPastPapersService } from './public-past-papers.service.js';
import { PublicPostsController } from './public-posts.controller.js';
import { PublicPostsService } from './public-posts.service.js';
import { PublicStudyMaterialsController } from './public-study-materials.controller.js';
import { PublicStudyMaterialsService } from './public-study-materials.service.js';
import { PublicSyllabusController } from './public-syllabus.controller.js';
import { PublicSyllabusService } from './public-syllabus.service.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  controllers: [
    PublicExamBoardsController,
    PublicPostsController,
    PublicSyllabusController,
    PublicPastPapersController,
    PublicStudyMaterialsController,
    SearchController,
  ],
  providers: [
    PublicExamBoardsService,
    PublicPostsService,
    PublicSyllabusService,
    PublicPastPapersService,
    PublicStudyMaterialsService,
    SearchService,
  ],
})
export class PublicContentModule {}
