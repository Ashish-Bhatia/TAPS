import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { ExamBoardModule } from './exam-board/exam-board.module.js';
import { HealthController } from './health/health.controller.js';
import { ReadinessController } from './health/readiness.controller.js';
import { PastPaperModule } from './past-paper/past-paper.module.js';
import { PostModule } from './post/post.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicContentModule } from './public-content/public-content.module.js';
import { QuizAttemptModule } from './quiz-attempt/quiz-attempt.module.js';
import { RevalidationModule } from './revalidation/revalidation.module.js';
import { UserAuthModule } from './user-auth/user-auth.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
    PrismaModule,
    RevalidationModule,
    AuthModule,
    ExamBoardModule,
    PostModule,
    PastPaperModule,
    PublicContentModule,
    UserAuthModule,
    QuizAttemptModule,
  ],
  controllers: [AppController, HealthController, ReadinessController],
  providers: [AppService, { provide: APP_FILTER, useClass: PrismaExceptionFilter }],
})
export class AppModule {}
