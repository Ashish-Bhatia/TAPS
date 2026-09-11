import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReadinessController } from './readiness.controller.js';

/**
 * Unit-level only: asserts the controller reacts correctly to whatever
 * `$queryRaw` does, via a mocked PrismaService. This is deliberately not
 * the evidence TAPS-2.7's claim rests on — a mock can only prove the
 * wiring is internally consistent, not that a real Prisma client talking
 * to a real Postgres actually behaves this way. The real, non-mocked
 * evidence (a running instance hitting a real reachable database, then a
 * real unreachable one) is recorded in
 * docs/adr/021-db-aware-readiness-check.md.
 */
describe('ReadinessController', () => {
  let controller: ReadinessController;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { $queryRaw: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadinessController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<ReadinessController>(ReadinessController);
  });

  it('reports ok when the database query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });

  it('throws a 503 ServiceUnavailableException when the database query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
