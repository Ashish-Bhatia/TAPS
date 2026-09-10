import { Test, TestingModule } from '@nestjs/testing';
import { PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PostService } from './post.service.js';

describe('PostService', () => {
  let service: PostService;
  const prismaMock = {
    post: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PostService>(PostService);
  });

  it('create converts the ISO publishedAt string to a Date before calling prisma', async () => {
    const dto = {
      type: PostType.ARTICLE,
      title: 'Hello',
      slug: 'hello',
      body: 'body',
      publishedAt: '2026-01-15T00:00:00.000Z',
    };
    prismaMock.post.create.mockResolvedValue({ id: '1', ...dto });

    await service.create(dto);

    expect(prismaMock.post.create).toHaveBeenCalledWith({
      data: { ...dto, publishedAt: new Date('2026-01-15T00:00:00.000Z') },
    });
  });

  it('create leaves publishedAt undefined when not provided (draft post)', async () => {
    const dto = { type: PostType.ARTICLE, title: 'Draft', slug: 'draft', body: 'body' };
    prismaMock.post.create.mockResolvedValue({ id: '1', ...dto });

    await service.create(dto);

    expect(prismaMock.post.create).toHaveBeenCalledWith({
      data: { ...dto, publishedAt: undefined },
    });
  });

  it('findAll filters by examBoardId when provided', async () => {
    prismaMock.post.findMany.mockResolvedValue([]);

    await service.findAll('board-1');

    expect(prismaMock.post.findMany).toHaveBeenCalledWith({
      where: { examBoardId: 'board-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAll has no where clause when examBoardId is omitted', async () => {
    prismaMock.post.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prismaMock.post.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
    });
  });
});
