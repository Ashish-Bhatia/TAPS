import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExamBoardType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ExamBoardController } from './exam-board.controller.js';
import { ExamBoardService } from './exam-board.service.js';

describe('ExamBoardController', () => {
  let controller: ExamBoardController;
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
      controllers: [ExamBoardController],
      providers: [{ provide: ExamBoardService, useValue: serviceMock }],
    })
      // This is a controller-logic unit test, not an auth test — the guard
      // itself (JwtStrategy resolving a real JWT_SECRET, etc.) is covered
      // separately by auth.service.spec.ts.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExamBoardController>(ExamBoardController);
  });

  it('findOne returns the exam board when the service finds one', async () => {
    const examBoard = { id: '1', name: 'DSSSB', type: ExamBoardType.TEACHING, description: 'x' };
    serviceMock.findOne.mockResolvedValue(examBoard);

    await expect(controller.findOne('1')).resolves.toEqual(examBoard);
  });

  it('findOne throws NotFoundException when the service returns null', async () => {
    serviceMock.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove delegates to the service and returns nothing', async () => {
    serviceMock.remove.mockResolvedValue(undefined);

    await expect(controller.remove('1')).resolves.toBeUndefined();
    expect(serviceMock.remove).toHaveBeenCalledWith('1');
  });
});
