import { render, screen } from '@testing-library/react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMyQuizAttempts, UnauthorizedApiError } from '../../lib/api';
import { requireSessionToken } from '../../lib/session';
import DashboardPage from './page';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, getMyQuizAttempts: vi.fn() };
});
vi.mock('../../lib/session', () => ({
  requireSessionToken: vi.fn(),
  SESSION_COOKIE_NAME: 'taps_session',
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
// Same "throw, don't silently return" mock as src/lib/session.test.ts —
// see that file's comment for why.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

beforeEach(() => {
  vi.mocked(requireSessionToken).mockResolvedValue('jwt-abc');
});

describe('DashboardPage', () => {
  it('renders the empty state when there are zero completed attempts', async () => {
    vi.mocked(getMyQuizAttempts).mockResolvedValue({
      attempts: [],
      accuracyTrend: [],
      weakTopicHeatmap: {},
    });

    render(await DashboardPage());

    expect(screen.getByText(/haven't completed any practice quizzes yet/)).toBeTruthy();
  });

  it('renders the attempt list, accuracy trend, and weak-topic heatmap when present', async () => {
    vi.mocked(getMyQuizAttempts).mockResolvedValue({
      attempts: [
        {
          id: 'attempt-1',
          examBoardId: 'board-1',
          score: 2,
          weakTopics: { Algebra: 1 },
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      accuracyTrend: [
        {
          attemptId: 'attempt-1',
          completedAt: '2026-01-01T00:00:00.000Z',
          score: 2,
          totalQuestions: 3,
          accuracy: 0.667,
        },
      ],
      weakTopicHeatmap: { Algebra: 1 },
    });

    render(await DashboardPage());

    expect(screen.getByText('Score: 2')).toBeTruthy();
    expect(screen.getByText('Missed: Algebra')).toBeTruthy();
    expect(screen.getByText('(1 incorrect)')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
  });

  it('clears the session cookie and redirects to /login when apps/api rejects the token', async () => {
    vi.mocked(getMyQuizAttempts).mockRejectedValue(new UnauthorizedApiError('401'));
    const deleteMock = vi.fn();
    vi.mocked(cookies).mockResolvedValue({ delete: deleteMock } as never);

    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(deleteMock).toHaveBeenCalledWith('taps_session');
  });

  it('rethrows any other error rather than treating it as a logged-out session', async () => {
    vi.mocked(getMyQuizAttempts).mockRejectedValue(new Error('API is down'));

    await expect(DashboardPage()).rejects.toThrow('API is down');
    expect(redirect).not.toHaveBeenCalled();
  });
});
