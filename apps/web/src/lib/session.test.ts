import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  clearSessionAndRedirectToLogin,
  getSessionToken,
  requireSessionToken,
  SESSION_COOKIE_NAME,
} from './session';

// redirect() never returns in real Next.js (it throws internally so the
// framework can catch a special digest and issue the response) — mocking
// it to throw here, rather than a plain no-op vi.fn(), is what lets the
// tests below actually prove that requireSessionToken()/
// clearSessionAndRedirectToLogin() don't fall through and return a value
// on the "not logged in" path.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

function mockCookieStore(get: ReturnType<typeof vi.fn>, del: ReturnType<typeof vi.fn> = vi.fn()) {
  vi.mocked(cookies).mockResolvedValue({ get, delete: del } as never);
  return del;
}

afterEach(() => {
  vi.mocked(redirect).mockClear();
});

describe('getSessionToken', () => {
  it('returns the cookie value when present', async () => {
    mockCookieStore(vi.fn().mockReturnValue({ value: 'jwt-value' }));
    await expect(getSessionToken()).resolves.toBe('jwt-value');
  });

  it('returns undefined when the cookie is absent', async () => {
    mockCookieStore(vi.fn().mockReturnValue(undefined));
    await expect(getSessionToken()).resolves.toBeUndefined();
  });
});

describe('requireSessionToken', () => {
  it('returns the token without redirecting when present', async () => {
    mockCookieStore(vi.fn().mockReturnValue({ value: 'jwt-value' }));

    await expect(requireSessionToken()).resolves.toBe('jwt-value');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /login when absent, and never returns a value', async () => {
    mockCookieStore(vi.fn().mockReturnValue(undefined));

    await expect(requireSessionToken()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});

describe('clearSessionAndRedirectToLogin', () => {
  it('deletes the session cookie and then redirects to /login', async () => {
    const del = mockCookieStore(vi.fn());

    await expect(clearSessionAndRedirectToLogin()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(del).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });
});
