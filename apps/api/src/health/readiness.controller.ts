import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * DB-aware readiness probe — TAPS-2.7. Deliberately separate from
 * `/health` (health.controller.ts), which stays DB-independent by design
 * so a slow/unreachable database never flaps Fly's liveness check and
 * takes an otherwise-fine machine out of rotation.
 *
 * This exists because `PrismaService.onModuleInit` fails soft (see
 * docs/adr/003-prisma-orm-and-connection-strategy.md): a DB outage at
 * boot no longer crashes the app, so nothing else in the process
 * surfaces that condition — a caller who specifically needs to know "can
 * this instance actually reach the database right now" (e.g. before
 * routing writes to it, or an operator diagnosing a Fly machine) has
 * nowhere to ask. `/ready` answers exactly that, with a real query, not
 * an assumption based on whether `$connect()` succeeded at boot (Prisma
 * connects lazily regardless, so that alone wouldn't prove anything about
 * the database's *current* reachability).
 */
@Controller()
export class ReadinessController {
  private readonly logger = new Logger(ReadinessController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async check(): Promise<{ status: 'ok' }> {
    try {
      // A trivial, side-effect-free round trip — proves the connection
      // pool can actually reach and query the database right now, not
      // just that `$connect()` happened to succeed at some point in the
      // past.
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Readiness check failed: database unreachable', error);
      throw new ServiceUnavailableException({ status: 'error', reason: 'database unreachable' });
    }
  }
}
