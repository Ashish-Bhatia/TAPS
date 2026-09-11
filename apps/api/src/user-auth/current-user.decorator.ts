import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserJwtPayload } from './user-jwt-payload.interface.js';

/**
 * Reads the `UserJwtPayload` that `UserJwtAuthGuard` attaches to the request
 * (see `UserJwtAuthGuard.canActivate`) so a controller handler can declare
 * `@CurrentUser() user: UserJwtPayload` instead of reaching into `@Req()`
 * itself. First consumer is `apps/api/src/quiz-attempt/` (TAPS-5.2) — this
 * lives in `user-auth/` rather than the consuming module because it's
 * defined entirely in terms of `UserJwtPayload`'s shape, the same reasoning
 * that keeps `UserJwtPayload` itself here.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserJwtPayload => {
    return ctx.switchToHttp().getRequest<Request & { user: UserJwtPayload }>().user;
  },
);
