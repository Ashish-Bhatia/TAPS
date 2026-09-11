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
    const query = { page: 1, pageSize: 20, examBoardId: 'board-1' };

    await controller.findAll(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query, 'board-1', undefined);
  });

  it('findAll works with no examBoardId (unfiltered listing)', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.findAll.mockResolvedValue(page);
    const query = { page: 1, pageSize: 20 };

    await controller.findAll(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query, undefined, undefined);
  });

  it('findAll passes the category query param through to the service (TAPS-3.8)', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.findAll.mockResolvedValue(page);
    const query = { page: 1, pageSize: 20, category: 'eligibility' };

    await controller.findAll(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query, undefined, 'eligibility');
  });
});
