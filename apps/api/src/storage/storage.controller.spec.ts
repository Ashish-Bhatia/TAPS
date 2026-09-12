import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';

describe('StorageController', () => {
  let controller: StorageController;
  const serviceMock = { upload: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StorageController>(StorageController);
  });

  it('throws BadRequestException when no file is provided', async () => {
    await expect(controller.upload(undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(serviceMock.upload).not.toHaveBeenCalled();
  });

  it('delegates to StorageService with the file buffer/name/mimetype and returns fileUrl', async () => {
    const file = {
      buffer: Buffer.from('%PDF-1.4'),
      originalname: 'SED-24-I Eng+Hin HHHH.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    serviceMock.upload.mockResolvedValue('https://cdn.example.com/past-papers/abc.pdf');

    const result = await controller.upload(file);

    expect(serviceMock.upload).toHaveBeenCalledWith(file.buffer, file.originalname, file.mimetype);
    expect(result).toEqual({ fileUrl: 'https://cdn.example.com/past-papers/abc.pdf' });
  });
});
