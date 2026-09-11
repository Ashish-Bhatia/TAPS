import { getMyQuizAttempts } from './dashboard';
import { UnauthorizedApiError } from './auth';

describe('getMyQuizAttempts', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the attempts/accuracyTrend/weakTopicHeatmap payload on success', async () => {
    const payload = {
      attempts: [
        {
          id: 'attempt-1',
          examBoardId: 'board-1',
          score: 2,
          weakTopics: { Algebra: 1 },
          completedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      accuracyTrend: [
        {
          attemptId: 'attempt-1',
          completedAt: '2026-01-02T00:00:00.000Z',
          score: 2,
          totalQuestions: 3,
          accuracy: 0.667,
        },
      ],
      weakTopicHeatmap: { Algebra: 1 },
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getMyQuizAttempts('a.b.c')).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[0][0]).toContain('/quiz-attempts/me');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer a.b.c' },
    });
  });

  it('returns empty arrays/object for a user with no completed attempts (not an error)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ attempts: [], accuracyTrend: [], weakTopicHeatmap: {} }),
    }) as unknown as typeof fetch;

    await expect(getMyQuizAttempts('a.b.c')).resolves.toEqual({
      attempts: [],
      accuracyTrend: [],
      weakTopicHeatmap: {},
    });
  });

  it('throws UnauthorizedApiError on a 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    await expect(getMyQuizAttempts('bad.token')).rejects.toBeInstanceOf(UnauthorizedApiError);
  });

  it('throws a plain Error on any other non-OK status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(getMyQuizAttempts('a.b.c')).rejects.not.toBeInstanceOf(UnauthorizedApiError);
  });
});
