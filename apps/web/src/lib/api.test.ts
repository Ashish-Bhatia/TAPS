import { getExamBoard, getExamBoardsForNav, getPostsByExamBoard, search } from './api';

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

describe('getExamBoard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the exam board on success', async () => {
    const board = { id: '1', name: 'DSSSB' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(board),
    }) as unknown as typeof fetch;

    await expect(getExamBoard('1')).resolves.toEqual(board);
  });

  it('returns null (not a throw) on a 404 — the caller turns this into notFound()', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    await expect(getExamBoard('missing')).resolves.toBeNull();
  });

  it('throws (does NOT fail soft) on a real error — unlike getExamBoardsForNav, this page depends on the fetch succeeding', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(getExamBoard('1')).rejects.toThrow();
  });
});

describe('getPostsByExamBoard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests the examBoardId-filtered posts endpoint and returns the data array', async () => {
    const posts = [{ id: '1', title: 'Notification' }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: posts, page: 1, pageSize: 100, total: 1, totalPages: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(getPostsByExamBoard('board-1')).resolves.toEqual(posts);
    expect(fetchMock.mock.calls[0][0]).toContain('/public/posts?examBoardId=board-1');
  });
});

describe('search', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('URL-encodes the query and returns the paginated result as-is', async () => {
    const page = {
      data: [{ type: 'exam-board', id: '1', title: 'DSSSB', examBoardId: null, rank: 0.3 }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(page) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(search('teacher eligibility')).resolves.toEqual(page);
    expect(fetchMock.mock.calls[0][0]).toContain('/public/search?q=teacher%20eligibility');
  });
});
