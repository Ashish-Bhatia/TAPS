import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Global so every feature module (ExamBoard, Post, ...) can inject
 * `PrismaService` without re-importing this module — there's exactly one
 * connection pool for the whole app. See docs/architecture/data-model.md.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
