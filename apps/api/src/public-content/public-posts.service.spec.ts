import { Test, TestingModule } from '@nestjs/testing';
import { Post, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicPostsService } from './public-posts.service.js';

describe('PublicPostsService', () => {
  let service: PublicPostsService;
  const prismaMock = {
    post: {
      findMany: vi.fn<(args: Prisma.PostFindManyArgs) => Promise<Post[]>>(),
      count: vi.fn<(args: Prisma.PostCountArgs) => Promise<number>>(),
      findFirst: vi.fn<(args: Prisma.PostFindFirstArgs) => Promise<Post | null>>(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicPostsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PublicPostsService>(PublicPostsService);
  });

  it('findAll only queries published posts (publishedAt set and not in the future)', async () => {
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.post.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20 });

    const where = prismaMock.post.findMany.mock.calls[0][0].where as Prisma.PostWhereInput & {
      publishedAt: { not: unknown; lte: unknown };
    };
    expect(where.publishedAt.not).toBeNull();
    expect(where.publishedAt.lte).toBeInstanceOf(Date);
    expect(where.examBoardId).toBeUndefined();
  });

  it('findAll adds examBoardId to the where clause when provided', async () => {
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.post.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20 }, 'board-1');

    const where = prismaMock.post.findMany.mock.calls[0][0].where;
    expect(where?.examBoardId).toBe('board-1');
  });

  it('findAll adds category to the where clause when provided (TAPS-3.8)', async () => {
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.post.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20 }, undefined, 'eligibility');

    const where = prismaMock.post.findMany.mock.calls[0][0].where;
    expect(where?.category).toBe('eligibility');
    expect(where?.examBoardId).toBeUndefined();
  });

  it('findAll combines examBoardId and category filters when both provided', async () => {
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.post.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20 }, 'board-1', 'exam-pattern');

    const where = prismaMock.post.findMany.mock.calls[0][0].where;
    expect(where?.examBoardId).toBe('board-1');
    expect(where?.category).toBe('exam-pattern');
  });

  it('findOne looks up by slug scoped to published posts only (drafts stay hidden)', async () => {
    prismaMock.post.findFirst.mockResolvedValue(null);

    await service.findOne('some-slug');

    const args = prismaMock.post.findFirst.mock.calls[0][0];
    const where = args.where as Prisma.PostWhereInput & { publishedAt: { not: unknown } };
    expect(where.slug).toBe('some-slug');
    expect(where.publishedAt.not).toBeNull();
  });
});
