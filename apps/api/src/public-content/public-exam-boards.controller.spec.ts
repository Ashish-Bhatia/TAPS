import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicExamBoardsController } from './public-exam-boards.controller.js';
import { PublicExamBoardsService } from './public-exam-boards.service.js';

describe('PublicExamBoardsController', () => {
  let controller: PublicExamBoardsController;
  const serviceMock = { findAll: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicExamBoardsController],
      providers: [{ provide: PublicExamBoardsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<PublicExamBoardsController>(PublicExamBoardsController);
  });

  it('findOne throws NotFoundException when the service returns null', async () => {
    serviceMock.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll delegates the pagination query straight through (no guard, no auth)', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.findAll.mockResolvedValue(page);

    await expect(controller.findAll({ page: 1, pageSize: 20 })).resolves.toEqual(page);
  });
});
