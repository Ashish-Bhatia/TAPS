import { NextRequest } from 'next/server';

const revalidateTagMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

// Imported AFTER the mock above so the route picks up the mocked module.
const { POST } = await import('./route');

function revalidateRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/revalidate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('POST /api/revalidate (TAPS-3.7)', () => {
  const originalSecret = process.env.REVALIDATION_SECRET;

  afterEach(() => {
    process.env.REVALIDATION_SECRET = originalSecret;
    revalidateTagMock.mockClear();
  });

  it('500s if REVALIDATION_SECRET is not configured, rather than accepting an unauthenticated call', async () => {
    delete process.env.REVALIDATION_SECRET;

    const response = await POST(revalidateRequest({ tags: ['exam-boards'] }));

    expect(response.status).toBe(500);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('401s when the Authorization header does not match the configured secret', async () => {
    process.env.REVALIDATION_SECRET = 'real-secret';

    const response = await POST(
      revalidateRequest({ tags: ['exam-boards'] }, { Authorization: 'Bearer wrong-secret' }),
    );

    expect(response.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('401s when no Authorization header is sent at all', async () => {
    process.env.REVALIDATION_SECRET = 'real-secret';

    const response = await POST(revalidateRequest({ tags: ['exam-boards'] }));

    expect(response.status).toBe(401);
  });

  it('400s when the body is not { tags: string[] }', async () => {
    process.env.REVALIDATION_SECRET = 'real-secret';

    const response = await POST(
      revalidateRequest({ tag: 'exam-boards' }, { Authorization: 'Bearer real-secret' }),
    );

    expect(response.status).toBe(400);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('400s on an empty tags array', async () => {
    process.env.REVALIDATION_SECRET = 'real-secret';

    const response = await POST(
      revalidateRequest({ tags: [] }, { Authorization: 'Bearer real-secret' }),
    );

    expect(response.status).toBe(400);
  });

  it('calls revalidateTag(tag, { expire: 0 }) for every tag and returns 200 with the correct secret', async () => {
    process.env.REVALIDATION_SECRET = 'real-secret';

    const response = await POST(
      revalidateRequest(
        { tags: ['exam-boards', 'exam-board-1'] },
        { Authorization: 'Bearer real-secret' },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      revalidated: true,
      tags: ['exam-boards', 'exam-board-1'],
    });
    expect(revalidateTagMock).toHaveBeenCalledTimes(2);
    expect(revalidateTagMock).toHaveBeenCalledWith('exam-boards', { expire: 0 });
    expect(revalidateTagMock).toHaveBeenCalledWith('exam-board-1', { expire: 0 });
  });
});
