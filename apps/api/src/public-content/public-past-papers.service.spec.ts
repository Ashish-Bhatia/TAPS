import { Test, TestingModule } from '@nestjs/testing';
import { PastPaper, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicPastPapersService } from './public-past-papers.service.js';

describe('PublicPastPapersService', () => {
  let service: PublicPastPapersService;
  const prismaMock = {
    pastPaper: {
      findMany: vi.fn<(args: Prisma.PastPaperFindManyArgs) => Promise<PastPaper[]>>(),
      count: vi.fn<(args: Prisma.PastPaperCountArgs) => Promise<number>>(),
      findUnique: vi.fn<(args: Prisma.PastPaperFindUniqueArgs) => Promise<PastPaper | null>>(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicPastPapersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PublicPastPapersService>(PublicPastPapersService);
  });

  it('findAll paginates using skip/take derived from page/pageSize, ordered by year desc', async () => {
    prismaMock.pastPaper.findMany.mockResolvedValue([{ id: '1' } as PastPaper]);
    prismaMock.pastPaper.count.mockResolvedValue(45);

    const result = await service.findAll({ page: 3, pageSize: 10 });

    expect(prismaMock.pastPaper.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ year: 'desc' }, { subject: 'asc' }],
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

  it('findAll adds examBoardId/subject/year to the where clause when provided', async () => {
    prismaMock.pastPaper.findMany.mockResolvedValue([]);
    prismaMock.pastPaper.count.mockResolvedValue(0);

    await service.findAll({
      page: 1,
      pageSize: 20,
      examBoardId: 'board-1',
      subject: 'Physics',
      year: 2024,
    });

    const where = prismaMock.pastPaper.findMany.mock.calls[0][0].where;
    expect(where?.examBoardId).toBe('board-1');
    expect(where?.subject).toBe('Physics');
    expect(where?.year).toBe(2024);
  });

  it('findAll leaves filters out of the where clause when not provided', async () => {
    prismaMock.pastPaper.findMany.mockResolvedValue([]);
    prismaMock.pastPaper.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20 });

    const where = prismaMock.pastPaper.findMany.mock.calls[0][0].where;
    expect(where?.examBoardId).toBeUndefined();
    expect(where?.subject).toBeUndefined();
    expect(where?.year).toBeUndefined();
  });

  it('findOne returns null (not a throw) when not found, letting the controller 404', async () => {
    prismaMock.pastPaper.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });
});
