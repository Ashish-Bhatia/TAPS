import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserAuthService } from './user-auth.service.js';

describe('UserAuthService', () => {
  let service: UserAuthService;
  const prismaMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  const jwtServiceMock = { signAsync: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<UserAuthService>(UserAuthService);
  });

  describe('register', () => {
    it('hashes the password, creates the user, and returns a signed JWT', async () => {
      prismaMock.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: 'New User',
      });
      jwtServiceMock.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.register({
        email: 'new@example.com',
        password: 'correct-horse-battery',
        name: 'New User',
      });

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      // No plaintext password ever reaches Prisma.
      const [{ data }] = prismaMock.user.create.mock.calls[0] as [
        { data: { email: string; name?: string; passwordHash: string } },
      ];
      expect(data.email).toBe('new@example.com');
      expect(data.name).toBe('New User');
      expect(data.passwordHash).not.toBe('correct-horse-battery');
      expect(await bcrypt.compare('correct-horse-battery', data.passwordHash)).toBe(true);
      // No admin claim/shape leaks into the user token payload.
      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'new@example.com',
      });
    });

    it('propagates a duplicate-email Prisma unique-constraint error (mapped to 409 by the global filter)', async () => {
      const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      });
      prismaMock.user.create.mockRejectedValue(duplicateError);

      await expect(
        service.register({ email: 'dup@example.com', password: 'correct-horse-battery' }),
      ).rejects.toBe(duplicateError);
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a signed JWT for correct credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'existing@example.com',
        passwordHash,
      });
      jwtServiceMock.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login({
        email: 'existing@example.com',
        password: 'correct-horse-battery',
      });

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'existing@example.com',
      });
    });

    it('rejects a wrong password with a generic 401', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'existing@example.com',
        passwordHash,
      });

      await expect(
        service.login({ email: 'existing@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent email with the identically-shaped generic 401', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'anything-at-all' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });

    it('produces an identical error message for wrong-password and nonexistent-email cases (enumeration-safety)', async () => {
      const passwordHash = await bcrypt.hash('correct-horse-battery', 10);
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'existing@example.com',
        passwordHash,
      });

      let wrongPasswordMessage: string | undefined;
      try {
        await service.login({ email: 'existing@example.com', password: 'wrong-password' });
      } catch (error) {
        wrongPasswordMessage = (error as UnauthorizedException).message;
      }

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      let nonexistentEmailMessage: string | undefined;
      try {
        await service.login({ email: 'nobody@example.com', password: 'wrong-password' });
      } catch (error) {
        nonexistentEmailMessage = (error as UnauthorizedException).message;
      }

      expect(wrongPasswordMessage).toBeDefined();
      expect(wrongPasswordMessage).toBe(nonexistentEmailMessage);
      expect(wrongPasswordMessage?.toLowerCase()).not.toContain('not found');
      expect(wrongPasswordMessage?.toLowerCase()).not.toContain('exist');
    });
  });
});
