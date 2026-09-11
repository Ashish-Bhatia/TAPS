import { Injectable } from '@nestjs/common';
import { PastPaper } from '@prisma/client';
import { PastPaperIngestionService } from '../ingestion/pastpaper-ingestion.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePastPaperDto } from './dto/create-past-paper.dto.js';
import { UpdatePastPaperDto } from './dto/update-past-paper.dto.js';

@Injectable()
export class PastPaperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: PastPaperIngestionService,
  ) {}

  /**
   * Creates the `PastPaper` row (`extractionStatus` starts at its schema
   * default, `PENDING`), then immediately runs TAPS-4.0's text-extraction
   * pipeline against it. `PastPaperIngestionService.ingest` never
   * throws/rejects, so the record this resolves to always reflects the
   * real outcome — `extractionStatus` is `DONE` or `FAILED`, never left at
   * `PENDING` — and that's what the admin API response exposes.
   */
  async create(dto: CreatePastPaperDto): Promise<PastPaper> {
    const created = await this.prisma.pastPaper.create({ data: dto });
    return this.ingestion.ingest(created.id, created.fileUrl);
  }

  findAll(examBoardId?: string): Promise<PastPaper[]> {
    return this.prisma.pastPaper.findMany({
      where: examBoardId ? { examBoardId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string): Promise<PastPaper | null> {
    return this.prisma.pastPaper.findUnique({ where: { id } });
  }

  update(id: string, dto: UpdatePastPaperDto): Promise<PastPaper> {
    // Prisma throws P2025 (mapped to 404 by PrismaExceptionFilter) if `id`
    // doesn't exist — no need to findOne-then-update here. Re-running
    // extraction on update (e.g. when fileUrl changes) is out of this
    // story's scope — see docs/backlog/BACKLOG.md.
    return this.prisma.pastPaper.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.pastPaper.delete({ where: { id } });
  }
}
