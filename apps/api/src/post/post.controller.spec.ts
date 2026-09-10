import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PostType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PostController } from './post.controller.js';
import { PostService } from './post.service.js';

describe('PostController', () => {
  let controller: PostController;
  const serviceMock = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [{ provide: PostService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PostController>(PostController);
  });

  it('findOne throws NotFoundException when the service returns null', async () => {
    serviceMock.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll passes the examBoardId query param through to the service', async () => {
    serviceMock.findAll.mockResolvedValue([]);

    await controller.findAll('board-1');

    expect(serviceMock.findAll).toHaveBeenCalledWith('board-1');
  });

  it('findAll works with no query param (public/unfiltered listing)', async () => {
    serviceMock.findAll.mockResolvedValue([]);

    await controller.findAll(undefined);

    expect(serviceMock.findAll).toHaveBeenCalledWith(undefined);
  });

  it('create delegates to the service', async () => {
    const dto = { type: PostType.ARTICLE, title: 'Hello', slug: 'hello', body: 'body' };
    serviceMock.create.mockResolvedValue({ id: '1', ...dto });

    await expect(controller.create(dto)).resolves.toEqual({ id: '1', ...dto });
  });
});
