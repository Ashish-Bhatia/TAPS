import { NextRequest } from 'next/server';
import proxy from './proxy';

function requestFor(path: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie } : undefined;
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('proxy (TAPS-5.0.5 optimistic auth check)', () => {
  it('redirects an unauthenticated visitor away from /dashboard to /login', () => {
    const response = proxy(requestFor('/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets an authenticated visitor through to /dashboard', () => {
    const response = proxy(requestFor('/dashboard', 'taps_session=jwt-abc'));

    // NextResponse.next() carries no redirect Location — this is the
    // "pass through" response, not a 3xx.
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects an already-authenticated visitor away from /login to /dashboard', () => {
    const response = proxy(requestFor('/login', 'taps_session=jwt-abc'));

    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('redirects an already-authenticated visitor away from /register to /dashboard', () => {
    const response = proxy(requestFor('/register', 'taps_session=jwt-abc'));

    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('lets an unauthenticated visitor reach /login', () => {
    const response = proxy(requestFor('/login'));

    expect(response.headers.get('location')).toBeNull();
  });
});
