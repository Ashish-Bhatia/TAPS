import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

// Same rationale as app/index.test.tsx: renders the actual
// app/exam-boards/[id].tsx route, navigated to via a real initialUrl (so
// useLocalSearchParams() gets its `id` from the real router, not a manual
// prop), with a mocked fetch.
describe('app/exam-boards/[id].tsx (exam board detail screen)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders the board info and its posts from a successful fetch', async () => {
    globalThis.fetch = jest.fn((url: string) => {
      if (url.includes('/public/exam-boards/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: 'board-1',
              name: 'CTET',
              type: 'TET',
              description: 'Central Teacher Eligibility Test',
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ id: 'post-1', title: 'CTET 2026 notification out' }],
            page: 1,
            pageSize: 100,
            total: 1,
            totalPages: 1,
          }),
      });
    }) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/exam-boards/board-1' });

    await waitFor(() => expect(screen.getByText('CTET')).toBeTruthy());
    expect(screen.getByText('Central Teacher Eligibility Test')).toBeTruthy();
    expect(screen.getByText('CTET 2026 notification out')).toBeTruthy();
  });

  it('renders a not-found state on a 404', async () => {
    // Only the board-detail call 404s — the posts call (also fired, via
    // Promise.all) must resolve OK, or it throws first and this exercises
    // the error state instead of the not-found one.
    globalThis.fetch = jest.fn((url: string) => {
      if (url.includes('/public/exam-boards/')) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [], page: 1, pageSize: 100, total: 0, totalPages: 0 }),
      });
    }) as unknown as typeof fetch;

    renderRouter('./app', { initialUrl: '/exam-boards/does-not-exist' });

    await waitFor(() => expect(screen.getByText('No exam board with this id.')).toBeTruthy());
  });
});
