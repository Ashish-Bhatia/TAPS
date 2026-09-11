import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

// Renders the *actual* route file (app/index.tsx) through expo-router's real
// route table — not a standalone component mount — with a mocked fetch.
// This is the render-level counterpart to src/lib/api.test.ts's data-layer
// tests: it proves the screen itself (JSX, FlatList, navigation wiring)
// correctly turns a successful fetch into visible text, not just that
// getExamBoards() returns the right array. A real, unmocked network call was
// tried here too (against the live deployed API) but React Native's Jest
// preset mocks networking at the native-module layer for hermetic tests —
// confirmed via two independent attempts (the default RN fetch polyfill
// resolves to nothing, and overriding globalThis.fetch with a real
// implementation gets a real 200 status but the body stream never resolves)
// — so this suite, like every other one in this repo, stays mocked; live
// verification of this exact render path was instead done manually and
// recorded in docs/backlog/BACKLOG.md's TAPS-6.1 row.
describe('app/index.tsx (exam board list screen)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders exam board names and types from a successful fetch', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { id: '1', name: 'DSSSB', type: 'TEACHING', description: 'Delhi board' },
            { id: '2', name: 'CTET', type: 'TET', description: 'Central eligibility test' },
          ],
          page: 1,
          pageSize: 100,
          total: 2,
          totalPages: 1,
        }),
    }) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/' });

    await waitFor(() => expect(screen.getByText('DSSSB')).toBeTruthy());
    expect(screen.getByText('CTET')).toBeTruthy();
    expect(screen.getByText('Teaching Exam')).toBeTruthy();
    expect(screen.getByText('TET')).toBeTruthy();
  });

  it('renders a retryable error state when the fetch fails', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/' });

    await waitFor(() =>
      expect(
        screen.getByText('Could not load exam boards. Check your connection and try again.'),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
