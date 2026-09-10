import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicPostsController } from './public-posts.controller.js';
import { PublicPostsService } from './public-posts.service.js';

describe('PublicPostsController', () => {
  let controller: PublicPostsController;
  const serviceMock = { findAll: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicPostsController],
      providers: [{ provide: PublicPostsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<PublicPostsController>(PublicPostsController);
  });

  it('findOne (by slug) throws NotFoundException when the service returns null', async () => {
    serviceMock.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing-slug')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll passes the examBoardId query param through to the service', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.findAll.mockResolvedValue(page);

    await controller.findAll({ page: 1, pageSize: 20 }, 'board-1');

    expect(serviceMock.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, 'board-1');
  });
});
