import { Module } from '@nestjs/common';
import { UserAuthModule } from '../user-auth/user-auth.module.js';
import { QuizAttemptController } from './quiz-attempt.controller.js';
import { QuizAttemptService } from './quiz-attempt.service.js';

// Imports UserAuthModule (not just the guard) for the same reason
// PastPaperModule imports AuthModule: @UseGuards(UserJwtAuthGuard) resolves
// through this module's own injector, which needs UserJwtAuthGuard's
// JwtService dependency visible — UserAuthModule re-exports JwtModule for
// exactly this.
@Module({
  imports: [UserAuthModule],
  controllers: [QuizAttemptController],
  providers: [QuizAttemptService],
})
export class QuizAttemptModule {}
