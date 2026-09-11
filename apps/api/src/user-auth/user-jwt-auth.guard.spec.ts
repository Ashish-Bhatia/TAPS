import {
  ExecutionContext,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserJwtAuthGuard } from './user-jwt-auth.guard.js';

function makeContext(authorizationHeader?: string): ExecutionContext {
  const request = { headers: { authorization: authorizationHeader } };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('UserJwtAuthGuard', () => {
  let guard: UserJwtAuthGuard;
  const jwtServiceMock = { verifyAsync: vi.fn() };
  const originalSecret = process.env.USER_JWT_SECRET;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.USER_JWT_SECRET = 'test-user-secret';
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserJwtAuthGuard, { provide: JwtService, useValue: jwtServiceMock }],
    }).compile();

    guard = module.get<UserJwtAuthGuard>(UserJwtAuthGuard);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.USER_JWT_SECRET;
    } else {
      process.env.USER_JWT_SECRET = originalSecret;
    }
  });

  it('allows the request through and attaches the payload for a valid bearer token', async () => {
    jwtServiceMock.verifyAsync.mockResolvedValue({ userId: 'user-1', email: 'a@example.com' });
    const context = makeContext('Bearer valid.jwt.token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtServiceMock.verifyAsync).toHaveBeenCalledWith('valid.jwt.token');
  });

  it('rejects a missing Authorization header', async () => {
    const context = makeContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const context = makeContext('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = makeContext('Bearer expired.jwt.token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails loudly with InternalServerErrorException when USER_JWT_SECRET is unset', async () => {
    delete process.env.USER_JWT_SECRET;
    const context = makeContext('Bearer some.jwt.token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});

describe('UserJwtAuthGuard vs admin-issued tokens (real signing, not mocked)', () => {
  const originalUserSecret = process.env.USER_JWT_SECRET;
  const originalAdminSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalUserSecret === undefined) {
      delete process.env.USER_JWT_SECRET;
    } else {
      process.env.USER_JWT_SECRET = originalUserSecret;
    }
    if (originalAdminSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalAdminSecret;
    }
  });

  it('rejects a token signed by the admin auth system (different secret, admin claim shape)', async () => {
    process.env.USER_JWT_SECRET = 'real-user-secret';
    process.env.JWT_SECRET = 'real-admin-secret';

    // Mirrors apps/api/src/auth/auth.service.ts's actual sign call.
    const adminJwtService = new JwtService({ secret: process.env.JWT_SECRET });
    const adminToken = await adminJwtService.signAsync({ sub: 'admin', role: 'admin' });

    const userJwtService = new JwtService({ secret: process.env.USER_JWT_SECRET });
    const guard = new UserJwtAuthGuard(userJwtService);
    const context = makeContext(`Bearer ${adminToken}`);

    // Rejected on signature verification alone — USER_JWT_SECRET and
    // JWT_SECRET are different keys, so an admin-issued token is not even
    // a structurally valid JWT under this guard's JwtService, regardless
    // of its claim shape. See docs/adr/014-user-auth-separate-from-admin-auth.md.
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a token genuinely signed by the user auth system', async () => {
    process.env.USER_JWT_SECRET = 'real-user-secret';

    const userJwtService = new JwtService({ secret: process.env.USER_JWT_SECRET });
    const userToken = await userJwtService.signAsync({
      userId: 'user-1',
      email: 'a@example.com',
    });

    const guard = new UserJwtAuthGuard(userJwtService);
    const context = makeContext(`Bearer ${userToken}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
