import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../user-auth/current-user.decorator.js';
import { UserJwtAuthGuard } from '../user-auth/user-jwt-auth.guard.js';
// `import type` (not a value import): UserJwtPayload is a pure interface,
// and TS requires that made explicit for a type referenced on a decorated
// parameter (`@CurrentUser()` below) when emitDecoratorMetadata is on —
// otherwise it can't tell the reference is erasable at emit time.
import type { UserJwtPayload } from '../user-auth/user-jwt-payload.interface.js';
import { StartQuizAttemptDto } from './dto/start-quiz-attempt.dto.js';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto.js';
import { QuizAttemptService } from './quiz-attempt.service.js';
import type { StartQuizAttemptResult, SubmitQuizAttemptResult } from './quiz-attempt.service.js';

/**
 * End-user quiz-taking endpoints (TAPS-5.2) — guarded by `UserJwtAuthGuard`
 * (the TAPS-5.1 user-session system), never the admin `JwtAuthGuard`: a
 * quiz attempt belongs to one authenticated end user, not a CMS operator.
 * See docs/adr/015-quiz-attempt-data-shape.md.
 */
@Controller('quiz-attempts')
@UseGuards(UserJwtAuthGuard)
export class QuizAttemptController {
  constructor(private readonly quizAttemptService: QuizAttemptService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentUser() user: UserJwtPayload,
    @Body() dto: StartQuizAttemptDto,
  ): Promise<StartQuizAttemptResult> {
    return this.quizAttemptService.start(user.userId, dto.examBoardId);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() user: UserJwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitQuizAttemptDto,
  ): Promise<SubmitQuizAttemptResult> {
    return this.quizAttemptService.submit(user.userId, id, dto.answers);
  }
}
