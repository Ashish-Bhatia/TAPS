import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- matching jest.mock's own factory above
const mockedSecureStore = require('expo-secure-store') as {
  getItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

describe('app/account.tsx', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows the logged-out state and a link to /login when no session is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    renderRouter('./app', { initialUrl: '/account' });

    await waitFor(() => expect(screen.getByText("You're not logged in.")).toBeTruthy());
    expect(screen.getByText('Log in')).toBeTruthy();
  });

  it('restores a persisted session on mount and shows the logged-in state', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'stored.jwt', email: 'stored@example.com' }),
    );

    renderRouter('./app', { initialUrl: '/account' });

    await waitFor(() => expect(screen.getByText('Logged in as stored@example.com')).toBeTruthy());
  });

  it('logs out, clears the stored session, and returns to the logged-out state', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'stored.jwt', email: 'stored@example.com' }),
    );

    renderRouter('./app', { initialUrl: '/account' });

    await waitFor(() => expect(screen.getByText('Logged in as stored@example.com')).toBeTruthy());
    fireEvent.press(screen.getByText('Log out'));

    await waitFor(() => expect(screen.getByText("You're not logged in.")).toBeTruthy());
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('taps_session');
  });
});
