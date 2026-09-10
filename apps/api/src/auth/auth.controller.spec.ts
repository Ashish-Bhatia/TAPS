import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  const serviceMock = { login: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('delegates to AuthService.login with the DTO password', async () => {
    serviceMock.login.mockResolvedValue({ accessToken: 'jwt.token' });

    const result = await controller.login({ password: 'correct-horse' });

    expect(serviceMock.login).toHaveBeenCalledWith('correct-horse');
    expect(result).toEqual({ accessToken: 'jwt.token' });
  });
});
