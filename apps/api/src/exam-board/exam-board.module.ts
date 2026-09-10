import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ExamBoardController } from './exam-board.controller.js';
import { ExamBoardService } from './exam-board.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ExamBoardController],
  providers: [ExamBoardService],
})
export class ExamBoardModule {}
