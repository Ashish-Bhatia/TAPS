import {
  ExecutionContext,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function makeContext(authorizationHeader?: string): ExecutionContext {
  const request = { headers: { authorization: authorizationHeader } };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const jwtServiceMock = { verifyAsync: vi.fn() };
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, { provide: JwtService, useValue: jwtServiceMock }],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('allows the request through and attaches the payload for a valid bearer token', async () => {
    jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'admin', role: 'admin' });
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

  it('fails loudly with InternalServerErrorException when JWT_SECRET is unset', async () => {
    delete process.env.JWT_SECRET;
    const context = makeContext('Bearer some.jwt.token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
