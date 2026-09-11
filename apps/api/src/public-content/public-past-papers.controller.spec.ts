import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicPastPapersController } from './public-past-papers.controller.js';
import { PublicPastPapersService } from './public-past-papers.service.js';

describe('PublicPastPapersController', () => {
  let controller: PublicPastPapersController;
  const serviceMock = { findAll: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicPastPapersController],
      providers: [{ provide: PublicPastPapersService, useValue: serviceMock }],
    }).compile();

    controller = module.get<PublicPastPapersController>(PublicPastPapersController);
  });

  it('findOne throws NotFoundException when the service returns null', async () => {
    serviceMock.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll delegates the query straight through (no guard, no auth)', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.findAll.mockResolvedValue(page);
    const query = { page: 1, pageSize: 20, examBoardId: 'board-1', subject: 'Physics', year: 2024 };

    await expect(controller.findAll(query)).resolves.toEqual(page);
    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
  });
});
