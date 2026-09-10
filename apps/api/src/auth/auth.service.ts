import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

/**
 * Single-admin auth: there's no User table yet (EPIC 5 — user accounts —
 * hasn't started), so this deliberately doesn't build a user system to
 * protect a handful of CMS endpoints early. One shared admin credential,
 * hashed at rest (`ADMIN_PASSWORD_HASH`), exchanged for a JWT on login. See
 * docs/adr/005-admin-auth-and-validation.md.
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(password: string): Promise<{ accessToken: string }> {
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!passwordHash) {
      // Misconfiguration, not a bad login attempt — fail loudly rather than
      // silently rejecting every login with an ambiguous 401.
      throw new InternalServerErrorException('ADMIN_PASSWORD_HASH is not configured');
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({ sub: 'admin', role: 'admin' });
    return { accessToken };
  }
}
