import { Test, TestingModule } from '@nestjs/testing';
import { UserAuthController } from './user-auth.controller.js';
import { UserAuthService } from './user-auth.service.js';

describe('UserAuthController', () => {
  let controller: UserAuthController;
  const serviceMock = { register: vi.fn(), login: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAuthController],
      providers: [{ provide: UserAuthService, useValue: serviceMock }],
    }).compile();

    controller = module.get<UserAuthController>(UserAuthController);
  });

  it('delegates registration to UserAuthService.register with the DTO', async () => {
    serviceMock.register.mockResolvedValue({ accessToken: 'jwt.token' });

    const dto = { email: 'new@example.com', password: 'correct-horse-battery', name: 'New User' };
    const result = await controller.register(dto);

    expect(serviceMock.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'jwt.token' });
  });

  it('delegates login to UserAuthService.login with the DTO', async () => {
    serviceMock.login.mockResolvedValue({ accessToken: 'jwt.token' });

    const dto = { email: 'existing@example.com', password: 'correct-horse-battery' };
    const result = await controller.login(dto);

    expect(serviceMock.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'jwt.token' });
  });
});
