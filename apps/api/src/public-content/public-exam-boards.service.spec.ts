import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicExamBoardsService } from './public-exam-boards.service.js';

describe('PublicExamBoardsService', () => {
  let service: PublicExamBoardsService;
  const prismaMock = {
    examBoard: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicExamBoardsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PublicExamBoardsService>(PublicExamBoardsService);
  });

  it('findAll paginates using skip/take derived from page/pageSize', async () => {
    prismaMock.examBoard.findMany.mockResolvedValue([{ id: '1' }]);
    prismaMock.examBoard.count.mockResolvedValue(45);

    const result = await service.findAll({ page: 3, pageSize: 10 });

    expect(prismaMock.examBoard.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      skip: 20,
      take: 10,
    });
    expect(result).toEqual({
      data: [{ id: '1' }],
      page: 3,
      pageSize: 10,
      total: 45,
      totalPages: 5,
    });
  });

  it('findOne returns null (not a throw) when not found, letting the controller 404', async () => {
    prismaMock.examBoard.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });
});
