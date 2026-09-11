import { Injectable, Logger } from '@nestjs/common';

/**
 * TAPS-3.7 (docs/adr/019-tag-based-cache-revalidation.md): calls apps/web's
 * own `/api/revalidate` Route Handler server-to-server after a successful
 * ExamBoard/Post write, so apps/web's tagged caches (`apps/web/src/lib/api.ts`)
 * stay correct without a blind time-based revalidate window.
 *
 * Deliberately fails soft: a revalidation call is a caching optimization,
 * not a correctness requirement for the write that triggered it. The DB
 * write already succeeded by the time this runs — turning a revalidation
 * failure (apps/web down, network blip, misconfigured secret) into a 500 on
 * an otherwise-successful admin action would be strictly worse than the
 * cache staying stale a bit longer. Every failure path here logs and
 * returns, never throws.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  async revalidate(tags: string[]): Promise<void> {
    const secret = process.env.REVALIDATION_SECRET;
    if (!secret) {
      // Not configured (e.g. local dev without it set) — skip silently at
      // debug level, not an error: caching is opt-in infrastructure, and an
      // unconfigured secret here just means apps/web keeps serving whatever
      // it already has until that cache entry's tag is next revalidated.
      this.logger.debug('REVALIDATION_SECRET not configured — skipping revalidation call');
      return;
    }

    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3000';

    try {
      const response = await fetch(`${webAppUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ tags }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Revalidation call failed: ${response.status} for tags [${tags.join(', ')}]`,
        );
      }
    } catch (error) {
      this.logger.warn(`Revalidation call threw for tags [${tags.join(', ')}]: ${String(error)}`);
    }
  }
}
