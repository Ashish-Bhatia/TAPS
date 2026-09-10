import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('is defined and extends PrismaClient (has model delegates)', () => {
    expect(service).toBeDefined();
    expect(service.examBoard).toBeDefined();
    expect(service.post).toBeDefined();
  });

  it('connects on module init', async () => {
    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue();

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw if the initial connect attempt fails (lazy retry on first query instead)', async () => {
    vi.spyOn(service, '$connect').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('disconnects on module destroy', async () => {
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
