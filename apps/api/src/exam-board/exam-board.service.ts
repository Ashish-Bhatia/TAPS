import { Injectable } from '@nestjs/common';
import { ExamBoard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { CreateExamBoardDto } from './dto/create-exam-board.dto.js';
import { UpdateExamBoardDto } from './dto/update-exam-board.dto.js';

// Must match apps/web/src/lib/api.ts's EXAM_BOARDS_TAG/examBoardTag exactly
// — no shared package between the two apps (see docs/adr/019-tag-based-
// cache-revalidation.md), so these are duplicated by convention.
const EXAM_BOARDS_TAG = 'exam-boards';
function examBoardTag(id: string): string {
  return `exam-board-${id}`;
}

@Injectable()
export class ExamBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  async create(dto: CreateExamBoardDto): Promise<ExamBoard> {
    const board = await this.prisma.examBoard.create({ data: dto });
    await this.revalidation.revalidate([EXAM_BOARDS_TAG]);
    return board;
  }

  findAll(): Promise<ExamBoard[]> {
    return this.prisma.examBoard.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string): Promise<ExamBoard | null> {
    return this.prisma.examBoard.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateExamBoardDto): Promise<ExamBoard> {
    // Prisma throws P2025 (mapped to 404 by PrismaExceptionFilter) if `id`
    // doesn't exist — no need to findOne-then-update here.
    const board = await this.prisma.examBoard.update({ where: { id }, data: dto });
    await this.revalidation.revalidate([EXAM_BOARDS_TAG, examBoardTag(id)]);
    return board;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.examBoard.delete({ where: { id } });
    await this.revalidation.revalidate([EXAM_BOARDS_TAG, examBoardTag(id)]);
  }
}
