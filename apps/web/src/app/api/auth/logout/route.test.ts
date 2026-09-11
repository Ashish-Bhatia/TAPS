import { NextRequest } from 'next/server';
import { POST } from './route';

describe('POST /api/auth/logout (TAPS-5.0.5)', () => {
  it('deletes the session cookie and redirects home, without calling apps/api', async () => {
    const fetchMock = vi.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    const request = new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('taps_session=');
    // A deleted cookie is expressed as an already-past Expires date —
    // confirms this really clears it rather than setting an empty value
    // that would still count as "present" to getSessionToken().
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(fetchMock).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});
