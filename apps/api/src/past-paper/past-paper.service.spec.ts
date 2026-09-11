import { Test, TestingModule } from '@nestjs/testing';
import { ExtractionStatus } from '@prisma/client';
import { PastPaperIngestionService } from '../ingestion/pastpaper-ingestion.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PastPaperService } from './past-paper.service.js';

describe('PastPaperService', () => {
  let service: PastPaperService;
  const prismaMock = {
    pastPaper: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const ingestionMock = {
    ingest: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PastPaperService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PastPaperIngestionService, useValue: ingestionMock },
      ],
    }).compile();

    service = module.get<PastPaperService>(PastPaperService);
  });

  it('create persists the row then runs ingestion, returning ingestion’s result', async () => {
    const dto = {
      examBoardId: 'board-1',
      subject: 'Maths',
      year: 2025,
      fileUrl: 'https://x/y.pdf',
    };
    const created = { id: 'pp-1', ...dto, extractionStatus: ExtractionStatus.PENDING };
    const ingested = { ...created, extractionStatus: ExtractionStatus.DONE, extractedText: 'text' };
    prismaMock.pastPaper.create.mockResolvedValue(created);
    ingestionMock.ingest.mockResolvedValue(ingested);

    const result = await service.create(dto);

    expect(prismaMock.pastPaper.create).toHaveBeenCalledWith({ data: dto });
    expect(ingestionMock.ingest).toHaveBeenCalledWith('pp-1', dto.fileUrl);
    expect(result).toEqual(ingested);
    expect(result.extractionStatus).toBe(ExtractionStatus.DONE);
  });

  it('findAll filters by examBoardId when provided', async () => {
    prismaMock.pastPaper.findMany.mockResolvedValue([]);

    await service.findAll('board-1');

    expect(prismaMock.pastPaper.findMany).toHaveBeenCalledWith({
      where: { examBoardId: 'board-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAll has no where clause when examBoardId is omitted', async () => {
    prismaMock.pastPaper.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prismaMock.pastPaper.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne returns null when not found (no throw)', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(null);

    const result = await service.findOne('missing');

    expect(result).toBeNull();
  });

  it('update delegates to prisma.pastPaper.update without re-running ingestion', async () => {
    prismaMock.pastPaper.update.mockResolvedValue({ id: 'pp-1', subject: 'Physics' });

    await service.update('pp-1', { subject: 'Physics' });

    expect(prismaMock.pastPaper.update).toHaveBeenCalledWith({
      where: { id: 'pp-1' },
      data: { subject: 'Physics' },
    });
    expect(ingestionMock.ingest).not.toHaveBeenCalled();
  });

  it('remove delegates to prisma.pastPaper.delete', async () => {
    prismaMock.pastPaper.delete.mockResolvedValue({ id: 'pp-1' });

    await service.remove('pp-1');

    expect(prismaMock.pastPaper.delete).toHaveBeenCalledWith({ where: { id: 'pp-1' } });
  });
});
