import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicStudyMaterialsController } from './public-study-materials.controller.js';
import { PublicStudyMaterialsService } from './public-study-materials.service.js';

describe('PublicStudyMaterialsController', () => {
  let controller: PublicStudyMaterialsController;
  const serviceMock = { findAll: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicStudyMaterialsController],
      providers: [{ provide: PublicStudyMaterialsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<PublicStudyMaterialsController>(PublicStudyMaterialsController);
  });

  it('findOne throws NotFoundException when the service returns null', async () => {
    serviceMock.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll delegates the query straight through (no guard, no auth)', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.findAll.mockResolvedValue(page);
    const query = { page: 1, pageSize: 20, subject: 'Chemistry' };

    await expect(controller.findAll(query)).resolves.toEqual(page);
    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
  });
});
