import * as SecureStore from 'expo-secure-store';

import {
  apiFetchAuthed,
  clearStoredSession,
  getStoredSession,
  login,
  UnauthorizedApiError,
} from './auth';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('login', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('persists { accessToken, email } via SecureStore on a successful login', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ accessToken: 'real.jwt.token' }),
    }) as unknown as typeof fetch;

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({
      ok: true,
      session: { accessToken: 'real.jwt.token', email: 'user@example.com' },
    });
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'taps_session',
      JSON.stringify({ accessToken: 'real.jwt.token', email: 'user@example.com' }),
    );
  });

  it('returns invalid_credentials on a 401, without storing anything', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const result = await login('user@example.com', 'wrong-password');

    expect(result).toEqual({ ok: false, error: 'invalid_credentials' });
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('returns invalid_input on a 400', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

    const result = await login('not-an-email', 'x');

    expect(result).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('returns unknown when the network call itself throws', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({ ok: false, error: 'unknown' });
  });

  it('returns unknown on an unexpected non-OK status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({ ok: false, error: 'unknown' });
  });
});

describe('getStoredSession', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the parsed session when one is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'stored.jwt', email: 'stored@example.com' }),
    );

    await expect(getStoredSession()).resolves.toEqual({
      accessToken: 'stored.jwt',
      email: 'stored@example.com',
    });
  });

  it('returns null when nothing is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await expect(getStoredSession()).resolves.toBeNull();
  });

  it('returns null (fails safe) on a corrupted stored value', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('not valid json');

    await expect(getStoredSession()).resolves.toBeNull();
  });
});

describe('clearStoredSession', () => {
  it('deletes the SecureStore entry', async () => {
    await clearStoredSession();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('taps_session');
  });
});

describe('apiFetchAuthed', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the token as an Authorization: Bearer header', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hello: 'world' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetchAuthed('/quiz-attempts/me', 'a.b.c')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer a.b.c' },
    });
  });

  it('throws UnauthorizedApiError on a 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    await expect(apiFetchAuthed('/quiz-attempts/me', 'bad.token')).rejects.toBeInstanceOf(
      UnauthorizedApiError,
    );
  });

  it('throws a plain Error on any other non-OK status', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(apiFetchAuthed('/quiz-attempts/me', 'a.b.c')).rejects.not.toBeInstanceOf(
      UnauthorizedApiError,
    );
  });
});
