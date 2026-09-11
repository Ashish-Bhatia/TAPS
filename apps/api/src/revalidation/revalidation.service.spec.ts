import { RevalidationService } from './revalidation.service.js';

describe('RevalidationService', () => {
  const originalFetch = global.fetch;
  const originalSecret = process.env.REVALIDATION_SECRET;
  const originalWebUrl = process.env.WEB_APP_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.REVALIDATION_SECRET = originalSecret;
    process.env.WEB_APP_URL = originalWebUrl;
  });

  it('does nothing (no fetch call) when REVALIDATION_SECRET is not configured', async () => {
    delete process.env.REVALIDATION_SECRET;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await new RevalidationService().revalidate(['exam-boards']);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs to WEB_APP_URL/api/revalidate with the secret as a Bearer token and the tags in the body', async () => {
    process.env.REVALIDATION_SECRET = 'shared-secret';
    process.env.WEB_APP_URL = 'https://web.example.com';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    await new RevalidationService().revalidate(['exam-boards', 'exam-board-1']);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://web.example.com/api/revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer shared-secret' }) as unknown,
      }),
    );
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(call[1].body as string)).toEqual({ tags: ['exam-boards', 'exam-board-1'] });
  });

  it('falls back to http://localhost:3000 when WEB_APP_URL is not set', async () => {
    process.env.REVALIDATION_SECRET = 'shared-secret';
    delete process.env.WEB_APP_URL;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    await new RevalidationService().revalidate(['exam-boards']);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/revalidate');
  });

  it('does not throw when the revalidation call responds non-OK — a caching failure must never fail the write that triggered it', async () => {
    process.env.REVALIDATION_SECRET = 'shared-secret';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(new RevalidationService().revalidate(['exam-boards'])).resolves.toBeUndefined();
  });

  it('does not throw when the fetch itself rejects (apps/web unreachable)', async () => {
    process.env.REVALIDATION_SECRET = 'shared-secret';
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(new RevalidationService().revalidate(['exam-boards'])).resolves.toBeUndefined();
  });
});
