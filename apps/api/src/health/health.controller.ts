import { Controller, Get } from '@nestjs/common';

/**
 * Liveness/readiness probe. Fly.io's `http_service.checks` in `fly.toml` hits
 * this route to decide whether a machine is healthy; keep this response fast
 * and dependency-free (no DB/AI calls) so a slow downstream never flaps the
 * health check.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
