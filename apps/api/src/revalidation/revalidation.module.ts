import { Global, Module } from '@nestjs/common';
import { RevalidationService } from './revalidation.service.js';

/**
 * Global for the same reason as PrismaModule: multiple feature modules
 * (ExamBoard, Post) need `RevalidationService`, and there's exactly one of
 * it for the whole app.
 */
@Global()
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
