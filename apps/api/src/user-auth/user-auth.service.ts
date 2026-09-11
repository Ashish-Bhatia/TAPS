import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const BCRYPT_SALT_ROUNDS = 10; // same config as apps/api/src/auth/auth.service.ts's ADMIN_PASSWORD_HASH

// A precomputed hash of a fixed, never-issued password. Used only as the
// comparison target when no user matches the submitted email, so a
// nonexistent-email login still pays bcrypt's compare cost — see `login()`
// below for why.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('taps-user-auth-enumeration-guard', BCRYPT_SALT_ROUNDS);

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

/**
 * End-user account auth: registration + login for apps/api/src/user-auth/,
 * intentionally not sharing anything with apps/api/src/auth/AuthService
 * (the single-admin credential system) beyond the bcrypt salt-round config.
 * See docs/adr/014-user-auth-separate-from-admin-auth.md.
 */
@Injectable()
export class UserAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    // Duplicate email is left to the DB's unique constraint (P2002), mapped
    // to 409 by the global PrismaExceptionFilter — this also closes the
    // TOCTOU race a separate "check first" query would leave open.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
    });

    return this.signToken(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      // Enumeration-safety: still run a bcrypt compare (against a fixed
      // dummy hash) so a nonexistent-email attempt costs roughly the same
      // time as a wrong-password one, and throw the identical generic
      // error either way — never "user not found" vs "wrong password".
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.signToken(user.id, user.email);
  }

  private async signToken(userId: string, email: string): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({ userId, email });
    return { accessToken };
  }
}
