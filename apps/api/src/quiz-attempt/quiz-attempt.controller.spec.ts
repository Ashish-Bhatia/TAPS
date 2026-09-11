import { Test, TestingModule } from '@nestjs/testing';
import { UserJwtAuthGuard } from '../user-auth/user-jwt-auth.guard.js';
import { QuizAttemptController } from './quiz-attempt.controller.js';
import { QuizAttemptService } from './quiz-attempt.service.js';

describe('QuizAttemptController', () => {
  let controller: QuizAttemptController;
  const serviceMock = {
    start: vi.fn(),
    submit: vi.fn(),
    getMyAttempts: vi.fn(),
  };
  const user = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizAttemptController],
      providers: [{ provide: QuizAttemptService, useValue: serviceMock }],
    })
      .overrideGuard(UserJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QuizAttemptController>(QuizAttemptController);
  });

  it('start passes the authenticated user id and examBoardId through to the service', async () => {
    serviceMock.start.mockResolvedValue({ attemptId: 'attempt-1', questions: [] });

    const result = await controller.start(user, { examBoardId: 'board-1' });

    expect(serviceMock.start).toHaveBeenCalledWith('user-1', 'board-1');
    expect(result).toEqual({ attemptId: 'attempt-1', questions: [] });
  });

  it('submit passes the authenticated user id, attempt id, and answers through to the service', async () => {
    const submitted = { score: 1, totalQuestions: 1, weakTopics: {}, questions: [] };
    serviceMock.submit.mockResolvedValue(submitted);

    const result = await controller.submit(user, 'attempt-1', { answers: { 'q-1': 0 } });

    expect(serviceMock.submit).toHaveBeenCalledWith('user-1', 'attempt-1', { 'q-1': 0 });
    expect(result).toEqual(submitted);
  });

  it('getMine passes the authenticated user id through to the service', async () => {
    const aggregate = { attempts: [], accuracyTrend: [], weakTopicHeatmap: {} };
    serviceMock.getMyAttempts.mockResolvedValue(aggregate);

    const result = await controller.getMine(user);

    expect(serviceMock.getMyAttempts).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(aggregate);
  });
});
