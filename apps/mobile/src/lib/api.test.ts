import { apiUrl, getExamBoard, getExamBoards, getPostsByExamBoard } from './api';

describe('apiUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('falls back to the Android emulator loopback alias when unset', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(apiUrl()).toBe('http://10.0.2.2:8080');
  });

  it('uses EXPO_PUBLIC_API_URL when set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://taps-api.fly.dev';
    expect(apiUrl()).toBe('https://taps-api.fly.dev');
  });
});

describe('getExamBoards', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the paginated data array on success', async () => {
    const boards = [{ id: '1', name: 'DSSSB' }];
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ data: boards, page: 1, pageSize: 100, total: 1, totalPages: 1 }),
    }) as unknown as typeof fetch;

    await expect(getExamBoards()).resolves.toEqual(boards);
  });

  it('throws on a non-OK response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(getExamBoards()).rejects.toThrow('API request failed: 500');
  });
});

describe('getExamBoard', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the exam board on success', async () => {
    const board = { id: '1', name: 'DSSSB' };
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(board),
    }) as unknown as typeof fetch;

    await expect(getExamBoard('1')).resolves.toEqual(board);
  });

  it('returns null on a 404 (no such exam board), not a thrown error', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    await expect(getExamBoard('missing')).resolves.toBeNull();
  });

  it('throws on a non-404 error response', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(getExamBoard('1')).rejects.toThrow('API request failed: 500');
  });
});

describe('getPostsByExamBoard', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the paginated data array, filtered by examBoardId', async () => {
    const posts = [{ id: '1', title: 'Notification' }];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: posts, page: 1, pageSize: 100, total: 1, totalPages: 1 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getPostsByExamBoard('board-1')).resolves.toEqual(posts);
    expect(fetchMock.mock.calls[0][0]).toContain('examBoardId=board-1');
  });
});
