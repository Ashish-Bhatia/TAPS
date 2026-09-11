import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserAuthController } from './user-auth.controller.js';
import { UserAuthService } from './user-auth.service.js';
import { UserJwtAuthGuard } from './user-jwt-auth.guard.js';

@Module({
  imports: [
    // A separate JwtModule registration from AuthModule's, keyed on its own
    // USER_JWT_SECRET (not JWT_SECRET) — see UserJwtAuthGuard and
    // docs/adr/014-user-auth-separate-from-admin-auth.md for why the two
    // token systems must not share a signing key. A 7-day expiry (vs the
    // admin session's 12h) matches a consumer login persisting across
    // visits rather than a CMS operator's working session.
    JwtModule.register({
      secret: process.env.USER_JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [UserAuthController],
  providers: [UserAuthService, UserJwtAuthGuard],
  // Re-export JwtModule too, not just the guard — same reasoning as
  // AuthModule: a future module resolving `@UseGuards(UserJwtAuthGuard)`
  // through its own injector needs UserJwtAuthGuard's JwtService dependency
  // visible, which Nest doesn't transitively expose otherwise.
  exports: [UserJwtAuthGuard, JwtModule],
})
export class UserAuthModule {}
