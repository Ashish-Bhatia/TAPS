import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around the generated Prisma Client that plugs into Nest's
 * module lifecycle: connects once on module init and disconnects cleanly on
 * shutdown, so every feature module injects this instead of constructing its
 * own `PrismaClient` (see docs/architecture/data-model.md).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Deliberately non-fatal: Prisma connects lazily on the first query
    // regardless, so a DB blip (or no DATABASE_URL at all, as in an e2e test
    // that never touches the DB) must not crash the whole app at boot — the
    // same "slow/unavailable downstream never flaps healthy things"
    // principle the /health endpoint already follows (see
    // health.controller.ts). A real outage surfaces as a failed query at
    // request time instead of a boot crash — see docs/adr/003-prisma-orm-and-connection-strategy.md.
    try {
      await this.$connect();
      this.logger.log('Connected to the database');
    } catch (error) {
      this.logger.error(
        'Could not connect to the database at startup; will retry lazily on first query',
        error,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
