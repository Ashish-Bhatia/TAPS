import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StorageService } from './storage.service.js';

export interface UploadResponse {
  fileUrl: string;
}

/**
 * TAPS-2.13: the real producer of a `fileUrl` for `POST /past-papers` (and,
 * later, `StudyMaterial`/`Book`) — admin uploads the source file here first,
 * then passes the returned `fileUrl` into that create call. Admin-only,
 * same `JwtAuthGuard` pattern as `PastPaperController`. 25MB cap matches the
 * largest CTET past-paper PDF seen in practice with headroom, not a
 * standard pulled from nowhere.
 */
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided (expected multipart field "file")');
    }

    const fileUrl = await this.storageService.upload(file.buffer, file.originalname, file.mimetype);
    return { fileUrl };
  }
}
