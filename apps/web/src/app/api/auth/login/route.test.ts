import { NextRequest } from 'next/server';
import { POST } from './route';

function formRequest(fields: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

describe('POST /api/auth/login (TAPS-5.0.5)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('redirects back to /login?error=missing_fields without calling apps/api at all', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(formRequest({ email: '', password: '' }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login?error=missing_fields');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('on success, calls apps/api server-to-server, sets an httpOnly session cookie on ITS OWN domain, and redirects to /dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ accessToken: 'jwt-abc' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(formRequest({ email: 'a@b.com', password: 'secret123' }));

    expect(fetchMock.mock.calls[0][0]).toContain('/user-auth/login');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'a@b.com',
      password: 'secret123',
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/dashboard');

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('taps_session=jwt-abc');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
  });

  it('redirects with error=invalid_credentials on a 401 from apps/api', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const response = await POST(formRequest({ email: 'a@b.com', password: 'wrong' }));

    expect(response.headers.get('location')).toContain('/login?error=invalid_credentials');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('redirects with error=unknown when apps/api is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const response = await POST(formRequest({ email: 'a@b.com', password: 'secret123' }));

    expect(response.headers.get('location')).toContain('/login?error=unknown');
  });
});
