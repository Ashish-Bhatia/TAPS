import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostController } from './post.controller.js';
import { PostService } from './post.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
