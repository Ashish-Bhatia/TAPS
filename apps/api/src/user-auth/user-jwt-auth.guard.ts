import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserJwtPayload } from './user-jwt-payload.interface.js';

/**
 * Verifies a `Bearer <jwt>` Authorization header for the *user* session
 * system, structurally identical in approach to
 * apps/api/src/auth/jwt-auth.guard.ts (plain CanActivate over
 * @nestjs/jwt's JwtService.verifyAsync — see
 * docs/adr/005-admin-auth-and-validation.md for why that's preferred over
 * @nestjs/passport's AuthGuard mixin here) but otherwise fully independent:
 * this guard's JwtService instance is configured (in UserAuthModule) with
 * USER_JWT_SECRET, not the admin JwtAuthGuard's JWT_SECRET. Signing keys
 * are different, not just claim shapes, so a token issued by the admin
 * AuthService fails signature verification here outright — it is rejected
 * before this guard ever looks at payload contents. See
 * docs/adr/014-user-auth-separate-from-admin-auth.md.
 */
@Injectable()
export class UserJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!process.env.USER_JWT_SECRET) {
      // Misconfiguration, not a bad request — matches JwtAuthGuard's
      // handling of a missing JWT_SECRET.
      throw new InternalServerErrorException('USER_JWT_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<UserJwtPayload>(token);
      // Same convention as the admin guard: the verified payload is
      // attached to the request for downstream handlers/decorators to read.
      (request as Request & { user: UserJwtPayload }).user = payload;
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
