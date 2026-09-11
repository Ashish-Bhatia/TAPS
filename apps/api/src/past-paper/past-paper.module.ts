import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PastPaperIngestionModule } from '../ingestion/pastpaper-ingestion.module.js';
import { PastPaperController } from './past-paper.controller.js';
import { PastPaperService } from './past-paper.service.js';

@Module({
  imports: [AuthModule, PastPaperIngestionModule, AIModule],
  controllers: [PastPaperController],
  providers: [PastPaperService],
})
export class PastPaperModule {}
