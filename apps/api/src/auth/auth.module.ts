import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // Re-export JwtModule (not just JwtAuthGuard): ExamBoardModule/PostModule
  // resolve `@UseGuards(JwtAuthGuard)` through their own injector, which
  // needs JwtAuthGuard's JwtService constructor dependency visible too —
  // Nest module encapsulation doesn't transitively expose an imported
  // module's own imports unless they're re-exported.
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
