import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

// Renders the actual app/login.tsx route through the real route table
// (same rationale as TAPS-6.1's app/index.test.tsx/app/exam-boards/
// [id].test.tsx) — proof the login screen itself, not just src/lib/auth.ts,
// correctly turns a login response into either a navigation to /account or
// a visible error message. expo-secure-store is mocked (jest-expo's
// automatic native-module mock resolves getItemAsync to undefined, i.e.
// "no stored session", which is what every test here wants at mount).
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('app/login.tsx', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('navigates to /account and reflects the logged-in state after a successful login', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ accessToken: 'real.jwt.token' }),
    }) as unknown as typeof fetch;

    const router = renderRouter('./app', { initialUrl: '/login' });

    fireEvent.changeText(screen.getByTestId('login-email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(router.getPathname()).toBe('/account'));
    expect(screen.getByText('Logged in as user@example.com')).toBeTruthy();
  });

  it('shows an error and does not navigate when the credentials are wrong', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const router = renderRouter('./app', { initialUrl: '/login' });

    fireEvent.changeText(screen.getByTestId('login-email-input'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'wrong-password');
    fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(screen.getByText('Incorrect email or password.')).toBeTruthy());
    expect(router.getPathname()).toBe('/login');
  });
});
