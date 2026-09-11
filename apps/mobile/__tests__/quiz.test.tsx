import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- matching jest.mock's own factory above
const mockedSecureStore = require('expo-secure-store') as { getItemAsync: jest.Mock };

const question = {
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
};

describe('app/quiz/[examBoardId].tsx', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('prompts to log in instead of starting a quiz when logged out', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    renderRouter('./app', { initialUrl: '/quiz/board-1' });

    await waitFor(() => expect(screen.getByText('Log in to take a practice quiz.')).toBeTruthy());
  });

  it('starts a quiz, lets the user answer, and shows the scored results on submit', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'a.b.c', email: 'user@example.com' }),
    );
    const fetchMock = jest.fn((url: string, _init?: { body: string }) => {
      if (url.includes('/quiz-attempts/start')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ attemptId: 'attempt-1', questions: [question] }),
        });
      }
      if (url.includes('/submit')) {
        return Promise.resolve({
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
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/quiz/board-1' });

    await waitFor(() => expect(screen.getByText(/2 \+ 2 = \?/)).toBeTruthy());
    expect(screen.getByText('0 of 1 answered')).toBeTruthy();

    fireEvent.press(screen.getByTestId('option-q1-1'));
    await waitFor(() => expect(screen.getByText('1 of 1 answered')).toBeTruthy());

    fireEvent.press(screen.getByTestId('quiz-submit-button'));

    await waitFor(() => expect(screen.getByText('1 / 1')).toBeTruthy());
    expect(screen.getByText(/Correct — answer: 4/)).toBeTruthy();
    expect(screen.getByText('Basic addition.')).toBeTruthy();

    // The submitted answer was sent for the right question/option.
    const submitCall = fetchMock.mock.calls.find(([url]) => (url as string).includes('/submit'));
    const submitInit = submitCall?.[1];
    expect(submitInit).toBeDefined();
    expect(JSON.parse(submitInit!.body)).toEqual({ answers: { q1: 1 } });
  });

  it('shows an error state when starting the quiz fails', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'a.b.c', email: 'user@example.com' }),
    );
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/quiz/board-1' });

    await waitFor(() =>
      expect(
        screen.getByText(
          'Could not start a quiz for this exam board. Check your connection and try again.',
        ),
      ).toBeTruthy(),
    );
  });
});
