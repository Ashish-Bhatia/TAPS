import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Syllabus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicSyllabusService } from './public-syllabus.service.js';

describe('PublicSyllabusService', () => {
  let service: PublicSyllabusService;
  const prismaMock = {
    syllabus: {
      findMany: vi.fn<(args: Prisma.SyllabusFindManyArgs) => Promise<Syllabus[]>>(),
      count: vi.fn<(args: Prisma.SyllabusCountArgs) => Promise<number>>(),
      findUnique: vi.fn<(args: Prisma.SyllabusFindUniqueArgs) => Promise<Syllabus | null>>(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicSyllabusService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PublicSyllabusService>(PublicSyllabusService);
  });

  it('findAll paginates using skip/take derived from page/pageSize, ordered by subject', async () => {
    prismaMock.syllabus.findMany.mockResolvedValue([{ id: '1' } as Syllabus]);
    prismaMock.syllabus.count.mockResolvedValue(45);

    const result = await service.findAll({ page: 3, pageSize: 10 });

    expect(prismaMock.syllabus.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ subject: 'asc' }],
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

  it('findAll adds examBoardId to the where clause when provided', async () => {
    prismaMock.syllabus.findMany.mockResolvedValue([]);
    prismaMock.syllabus.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20, examBoardId: 'board-1' });

    const where = prismaMock.syllabus.findMany.mock.calls[0][0].where;
    expect(where?.examBoardId).toBe('board-1');
    expect(where?.subject).toBeUndefined();
  });

  it('findAll adds subject to the where clause when provided', async () => {
    prismaMock.syllabus.findMany.mockResolvedValue([]);
    prismaMock.syllabus.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20, subject: 'Physics' });

    const where = prismaMock.syllabus.findMany.mock.calls[0][0].where;
    expect(where?.subject).toBe('Physics');
  });

  it('findOne returns null (not a throw) when not found, letting the controller 404', async () => {
    prismaMock.syllabus.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });
});
