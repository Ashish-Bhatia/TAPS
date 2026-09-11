import { Test, TestingModule } from '@nestjs/testing';
import { ExamBoardType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { ExamBoardService } from './exam-board.service.js';

describe('ExamBoardService', () => {
  let service: ExamBoardService;
  const prismaMock = {
    examBoard: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const revalidationMock = { revalidate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamBoardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RevalidationService, useValue: revalidationMock },
      ],
    }).compile();

    service = module.get<ExamBoardService>(ExamBoardService);
  });

  it('create delegates to prisma.examBoard.create and revalidates the exam-boards tag (TAPS-3.7)', async () => {
    const dto = { name: 'DSSSB', type: ExamBoardType.TEACHING, description: 'x' };
    prismaMock.examBoard.create.mockResolvedValue({ id: '1', ...dto });

    const result = await service.create(dto);

    expect(prismaMock.examBoard.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: '1', ...dto });
    expect(revalidationMock.revalidate).toHaveBeenCalledWith(['exam-boards']);
  });

  it('findAll orders by name ascending', async () => {
    prismaMock.examBoard.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prismaMock.examBoard.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('findOne returns null when not found (no throw)', async () => {
    prismaMock.examBoard.findUnique.mockResolvedValue(null);

    const result = await service.findOne('missing');

    expect(result).toBeNull();
    expect(prismaMock.examBoard.findUnique).toHaveBeenCalledWith({ where: { id: 'missing' } });
  });

  it('update delegates to prisma.examBoard.update and revalidates both the list and board tags (TAPS-3.7)', async () => {
    prismaMock.examBoard.update.mockResolvedValue({ id: '1', name: 'Updated' });

    await service.update('1', { name: 'Updated' });

    expect(prismaMock.examBoard.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'Updated' },
    });
    expect(revalidationMock.revalidate).toHaveBeenCalledWith(['exam-boards', 'exam-board-1']);
  });

  it('remove delegates to prisma.examBoard.delete and revalidates both the list and board tags (TAPS-3.7)', async () => {
    prismaMock.examBoard.delete.mockResolvedValue({ id: '1' });

    await service.remove('1');

    expect(prismaMock.examBoard.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(revalidationMock.revalidate).toHaveBeenCalledWith(['exam-boards', 'exam-board-1']);
  });
});
