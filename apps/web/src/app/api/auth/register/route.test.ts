import { NextRequest } from 'next/server';
import { POST } from './route';

function formRequest(fields: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

describe('POST /api/auth/register (TAPS-5.0.5)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('redirects back to /register?error=missing_fields without calling apps/api', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(formRequest({ email: '', password: '' }));

    expect(response.headers.get('location')).toContain('/register?error=missing_fields');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('omits an empty optional name field entirely rather than sending an empty string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ accessToken: 'jwt-abc' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await POST(formRequest({ email: 'a@b.com', password: 'secret123', name: '' }));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'a@b.com',
      password: 'secret123',
    });
  });

  it('on success, logs the new user straight in: sets the session cookie and redirects to /dashboard', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ accessToken: 'jwt-xyz' }),
    }) as unknown as typeof fetch;

    const response = await POST(
      formRequest({ email: 'new@b.com', password: 'secret123', name: 'Nadia' }),
    );

    expect(response.headers.get('location')).toContain('/dashboard');
    expect(response.headers.get('set-cookie') ?? '').toContain('taps_session=jwt-xyz');
  });

  it('redirects with error=email_taken on a 409 from apps/api', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 409 }) as unknown as typeof fetch;

    const response = await POST(formRequest({ email: 'dup@b.com', password: 'secret123' }));

    expect(response.headers.get('location')).toContain('/register?error=email_taken');
  });

  it('redirects with error=invalid_input on a 400 from apps/api', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

    const response = await POST(formRequest({ email: 'bad', password: 'x' }));

    expect(response.headers.get('location')).toContain('/register?error=invalid_input');
  });
});
