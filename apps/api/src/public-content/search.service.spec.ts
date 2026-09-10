import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchService } from './search.service.js';

describe('SearchService', () => {
  let service: SearchService;
  const prismaMock = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('returns paginated, ranked results with rank coerced to a number', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          type: 'post',
          id: '1',
          title: 'Recruitment drive',
          examBoardId: 'board-1',
          rank: 0.9998732,
        },
      ])
      .mockResolvedValueOnce([{ count: 1n }]);

    const result = await service.search({ q: 'recruitment', page: 1, pageSize: 20 });

    expect(result).toEqual({
      data: [
        {
          type: 'post',
          id: '1',
          title: 'Recruitment drive',
          examBoardId: 'board-1',
          rank: 0.9998732,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('returns an empty array with total 0 when nothing matches (not an error)', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

    const result = await service.search({ q: 'xyzzynonexistentqueryterm', page: 1, pageSize: 20 });

    expect(result).toEqual({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('runs the rows query and the count query in parallel (both invoked)', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);

    await service.search({ q: 'anything', page: 2, pageSize: 10 });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
