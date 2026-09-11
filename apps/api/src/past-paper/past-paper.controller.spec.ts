import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExtractionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PastPaperController } from './past-paper.controller.js';
import { PastPaperService } from './past-paper.service.js';

describe('PastPaperController', () => {
  let controller: PastPaperController;
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
      controllers: [PastPaperController],
      providers: [{ provide: PastPaperService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PastPaperController>(PastPaperController);
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

  it('create delegates to the service and the response exposes extractionStatus', async () => {
    const dto = {
      examBoardId: 'board-1',
      subject: 'Maths',
      year: 2025,
      fileUrl: 'https://x/y.pdf',
    };
    const created = {
      id: '1',
      ...dto,
      extractionStatus: ExtractionStatus.DONE,
      extractedText: 'some text',
    };
    serviceMock.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
    expect(result.extractionStatus).toBe(ExtractionStatus.DONE);
  });
});
