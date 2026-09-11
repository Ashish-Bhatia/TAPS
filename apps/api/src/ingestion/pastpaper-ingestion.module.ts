import { Module } from '@nestjs/common';
import { PastPaperIngestionService } from './pastpaper-ingestion.service.js';

@Module({
  providers: [PastPaperIngestionService],
  exports: [PastPaperIngestionService],
})
export class PastPaperIngestionModule {}
