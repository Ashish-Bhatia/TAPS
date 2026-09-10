import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface.js';

/**
 * Verifies a `Bearer <jwt>` Authorization header directly via JwtService,
 * rather than going through @nestjs/passport's AuthGuard/Strategy mixin —
 * see docs/adr/005-admin-auth-and-validation.md for why: the passport
 * mixin's AuthModuleOptions dependency failed to resolve during Nest's
 * eager provider instantiation at app boot (reproduced with the guard both
 * registered and not registered as an explicit AuthModule provider — two
 * different failures, not one flaky one), which crashed the entire app
 * including the DB-independent /health endpoint. This app only ever needs
 * one strategy (JWT), so Passport's multi-strategy abstraction wasn't
 * buying anything — verifying directly is simpler and removes the failure
 * mode entirely.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!process.env.JWT_SECRET) {
      // Misconfiguration, not a bad request — matches AuthService.login's
      // handling of a missing ADMIN_PASSWORD_HASH.
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // Same convention Passport's AuthGuard uses: the verified payload is
      // attached to the request for downstream handlers/decorators to read.
      (request as Request & { user: JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length);
  }
}
