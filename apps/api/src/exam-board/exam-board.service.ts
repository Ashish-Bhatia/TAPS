import { Injectable } from '@nestjs/common';
import { ExamBoard } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExamBoardDto } from './dto/create-exam-board.dto.js';
import { UpdateExamBoardDto } from './dto/update-exam-board.dto.js';

@Injectable()
export class ExamBoardService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExamBoardDto): Promise<ExamBoard> {
    return this.prisma.examBoard.create({ data: dto });
  }

  findAll(): Promise<ExamBoard[]> {
    return this.prisma.examBoard.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string): Promise<ExamBoard | null> {
    return this.prisma.examBoard.findUnique({ where: { id } });
  }

  update(id: string, dto: UpdateExamBoardDto): Promise<ExamBoard> {
    // Prisma throws P2025 (mapped to 404 by PrismaExceptionFilter) if `id`
    // doesn't exist — no need to findOne-then-update here.
    return this.prisma.examBoard.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.examBoard.delete({ where: { id } });
  }
}
