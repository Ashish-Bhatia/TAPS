import { startQuiz, submitQuiz } from './quiz';
import { UnauthorizedApiError } from './auth';

describe('startQuiz', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs { examBoardId } with the bearer token and returns the attempt', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          attemptId: 'attempt-1',
          questions: [
            {
              id: 'q1',
              pastPaperId: 'p1',
              subject: 'Maths',
              topic: 'Algebra',
              difficulty: 'EASY',
              questionText: '2 + 2 = ?',
              options: ['3', '4', '5', '6'],
              aiGenerated: true,
              reviewedByAdmin: false,
              aiProvider: 'ANTHROPIC',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await startQuiz('board-1', 'a.b.c');

    expect(result.attemptId).toBe('attempt-1');
    expect(result.questions).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/quiz-attempts/start');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer a.b.c', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init.body)).toEqual({ examBoardId: 'board-1' });
  });

  it('throws UnauthorizedApiError on a 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    await expect(startQuiz('board-1', 'bad.token')).rejects.toBeInstanceOf(UnauthorizedApiError);
  });

  it('throws a plain Error on a 400 (board has no questions yet)', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

    await expect(startQuiz('board-1', 'a.b.c')).rejects.not.toBeInstanceOf(UnauthorizedApiError);
  });
});

describe('submitQuiz', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs { answers } to /quiz-attempts/:id/submit and returns the score', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          score: 1,
          totalQuestions: 1,
          weakTopics: {},
          questions: [
            {
              id: 'q1',
              questionText: '2 + 2 = ?',
              options: ['3', '4', '5', '6'],
              correctOption: 1,
              explanation: 'Basic addition.',
              selectedOption: 1,
              isCorrect: true,
            },
          ],
        }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitQuiz('attempt-1', { q1: 1 }, 'a.b.c');

    expect(result.score).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/quiz-attempts/attempt-1/submit');
    expect(JSON.parse(init.body)).toEqual({ answers: { q1: 1 } });
  });

  it('throws UnauthorizedApiError on a 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    await expect(submitQuiz('attempt-1', {}, 'bad.token')).rejects.toBeInstanceOf(
      UnauthorizedApiError,
    );
  });

  it('throws a plain Error on a 409 (already submitted)', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 409 }) as unknown as typeof fetch;

    await expect(submitQuiz('attempt-1', {}, 'a.b.c')).rejects.not.toBeInstanceOf(
      UnauthorizedApiError,
    );
  });
});
