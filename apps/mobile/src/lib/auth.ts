import * as SecureStore from 'expo-secure-store';

import { apiUrl } from './api';

// TAPS-6.2 — expo-secure-store, not AsyncStorage: see
// docs/adr/023-mobile-auth-token-storage.md for why (OS-level encrypted
// storage — Android Keystore/iOS Keychain — vs AsyncStorage's plaintext).
// Not the httpOnly-cookie approach apps/web/src/lib/session.ts uses
// (TAPS-5.0.5) either — that pattern exists specifically to work around
// apps/api and apps/web being different browser-cookie domains, which has
// no equivalent in a native app: apps/mobile calls apps/api directly and
// sends the token itself as a normal `Authorization: Bearer` header, same
// as any other bearer-JWT client (docs/api/user-auth.md).
const SESSION_KEY = 'taps_session';

interface StoredSession {
  accessToken: string;
  email: string;
}

/**
 * Reads the persisted session, if any. `null` covers both "never logged
 * in" and "SecureStore has nothing under this key" — there's no need to
 * distinguish them, both mean "show the logged-out state".
 */
export async function getStoredSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    // Corrupted/unparseable value (shouldn't happen in practice — this
    // module is the only writer) — treat as logged out rather than throw,
    // same "fail to a safe state" instinct as apps/web's session checks.
    return null;
  }
}

async function storeSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export type LoginError = 'invalid_credentials' | 'invalid_input' | 'unknown';

export type LoginResult = { ok: true; session: StoredSession } | { ok: false; error: LoginError };

/**
 * Calls `POST /user-auth/login` (docs/api/user-auth.md) directly — no
 * server-to-server proxy needed, unlike apps/web's route handler, since
 * there's no cross-domain cookie problem for a native app to work around.
 * On success, persists `{ accessToken, email }` via expo-secure-store
 * (the email is the one the user typed, not decoded from the JWT — the
 * token's own payload has no need to be read client-side for anything
 * this app does with it).
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/user-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: 'unknown' };
  }

  if (response.status === 401) {
    return { ok: false, error: 'invalid_credentials' };
  }
  if (response.status === 400) {
    return { ok: false, error: 'invalid_input' };
  }
  if (!response.ok) {
    return { ok: false, error: 'unknown' };
  }

  const { accessToken } = (await response.json()) as { accessToken: string };
  const session: StoredSession = { accessToken, email };
  await storeSession(session);
  return { ok: true, session };
}

export async function logout(): Promise<void> {
  await clearStoredSession();
}

/**
 * Distinguishes "apps/api rejected the bearer token itself" from any other
 * failure — same convention/name as apps/web/src/lib/api.ts's
 * UnauthorizedApiError, for the same reason: callers (TAPS-6.3/6.4's
 * screens) need to tell a stale/expired session apart from a genuine API
 * outage, so they know to clear the session and send the user back to
 * /login rather than showing a generic error.
 */
export class UnauthorizedApiError extends Error {}

/**
 * Thin authenticated-fetch wrapper for TAPS-6.3/6.4's screens to build on —
 * mirrors apps/web/src/lib/api.ts's apiFetchAuthed. Lives here rather than
 * in api.ts because it's specifically about the auth token, not the public
 * content API api.ts otherwise wraps.
 */
export async function apiFetchAuthed<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    throw new UnauthorizedApiError(`API request failed: 401 ${path}`);
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}
