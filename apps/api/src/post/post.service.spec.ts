import { Test, TestingModule } from '@nestjs/testing';
import { PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
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
  const revalidationMock = { revalidate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RevalidationService, useValue: revalidationMock },
      ],
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

  it('create revalidates the post-board tag (TAPS-3.7) when the created post has an examBoardId', async () => {
    const dto = {
      type: PostType.ARTICLE,
      title: 'Hi',
      slug: 'hi',
      body: 'x',
      examBoardId: 'board-1',
    };
    prismaMock.post.create.mockResolvedValue({ id: '1', ...dto });

    await service.create(dto);

    expect(revalidationMock.revalidate).toHaveBeenCalledWith(['posts-board-1']);
  });

  it('create does NOT call revalidate when the post has no examBoardId', async () => {
    const dto = { type: PostType.ARTICLE, title: 'Draft', slug: 'draft', body: 'body' };
    prismaMock.post.create.mockResolvedValue({ id: '1', ...dto, examBoardId: null });

    await service.create(dto);

    expect(revalidationMock.revalidate).not.toHaveBeenCalled();
  });

  it("update revalidates the post-board tag (TAPS-3.7) using the updated record's examBoardId", async () => {
    prismaMock.post.update.mockResolvedValue({ id: '1', title: 'Updated', examBoardId: 'board-2' });

    await service.update('1', { title: 'Updated' });

    expect(revalidationMock.revalidate).toHaveBeenCalledWith(['posts-board-2']);
  });

  it("remove revalidates the post-board tag (TAPS-3.7) using the deleted record's examBoardId", async () => {
    prismaMock.post.delete.mockResolvedValue({ id: '1', examBoardId: 'board-3' });

    await service.remove('1');

    expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(revalidationMock.revalidate).toHaveBeenCalledWith(['posts-board-3']);
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
