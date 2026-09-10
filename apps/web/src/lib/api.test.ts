import { getExamBoardsForNav } from './api';

describe('getExamBoardsForNav', () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  it('returns the paginated data array on success', async () => {
    const boards = [{ id: '1', name: 'DSSSB' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ data: boards, page: 1, pageSize: 100, total: 1, totalPages: 1 }),
    }) as unknown as typeof fetch;

    await expect(getExamBoardsForNav()).resolves.toEqual(boards);
  });

  it('fails soft (empty array, logged) when the API is unreachable — must never break every page', async () => {
    console.error = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(getExamBoardsForNav()).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('fails soft when the API responds with a non-OK status', async () => {
    console.error = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(getExamBoardsForNav()).resolves.toEqual([]);
  });
});
