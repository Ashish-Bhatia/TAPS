import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe. Fly.io's `http_service.checks` in `fly.toml` hits this
 * route to decide whether a machine is healthy; keep this response fast
 * and dependency-free (no DB/AI calls) so a slow downstream never flaps the
 * health check. For a DB-aware check, see `GET /ready`
 * (readiness.controller.ts, TAPS-2.7) — deliberately a separate endpoint
 * rather than added here.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
