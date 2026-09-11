import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- matching jest.mock's own factory above
const mockedSecureStore = require('expo-secure-store') as { getItemAsync: jest.Mock };

describe('app/dashboard.tsx', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('prompts to log in when logged out', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    renderRouter('./app', { initialUrl: '/dashboard' });

    await waitFor(() => expect(screen.getByText('Log in to see your progress.')).toBeTruthy());
  });

  it('shows the empty-state message for a user with no completed attempts', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'a.b.c', email: 'user@example.com' }),
    );
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ attempts: [], accuracyTrend: [], weakTopicHeatmap: {} }),
    }) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/dashboard' });

    await waitFor(() =>
      expect(screen.getByText(/You haven't completed any practice quizzes yet/)).toBeTruthy(),
    );
  });

  it('renders the accuracy trend, weak topics, and attempt history for a real payload', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'a.b.c', email: 'user@example.com' }),
    );
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
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
              accuracy: 0.6667,
            },
          ],
          weakTopicHeatmap: { Algebra: 1 },
        }),
    }) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/dashboard' });

    await waitFor(() => expect(screen.getByText('Score: 2')).toBeTruthy());
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Algebra (1 incorrect)')).toBeTruthy();
    expect(screen.getByText('Missed: Algebra')).toBeTruthy();
  });

  it('logs out and redirects to /login on a 401 (stale/tampered token)', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'stale.jwt', email: 'user@example.com' }),
    );
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const router = renderRouter('./app', { initialUrl: '/dashboard' });

    await waitFor(() => expect(router.getPathname()).toBe('/login'));
  });
});
