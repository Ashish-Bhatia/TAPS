import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const jwtServiceMock = { signAsync: vi.fn() };
  const originalEnv = process.env.ADMIN_PASSWORD_HASH;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: JwtService, useValue: jwtServiceMock }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_PASSWORD_HASH;
    } else {
      process.env.ADMIN_PASSWORD_HASH = originalEnv;
    }
  });

  it('returns a signed JWT for the correct password', async () => {
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('correct-horse', 10);
    jwtServiceMock.signAsync.mockResolvedValue('signed.jwt.token');

    const result = await service.login('correct-horse');

    expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({ sub: 'admin', role: 'admin' });
  });

  it('rejects an incorrect password with UnauthorizedException', async () => {
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('correct-horse', 10);

    await expect(service.login('wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('fails loudly with InternalServerErrorException when ADMIN_PASSWORD_HASH is unset', async () => {
    delete process.env.ADMIN_PASSWORD_HASH;

    await expect(service.login('anything')).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
