import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  clearStoredSession,
  getStoredSession,
  login as loginRequest,
  type LoginResult,
} from './auth';

interface AuthState {
  // 'loading' only while the initial SecureStore read (app cold start) is
  // in flight — screens gated on auth should treat 'loading' as "don't
  // decide yet", not as logged-out, or a real session would flash a
  // logged-out state for a moment on every app launch.
  status: 'loading' | 'authenticated' | 'unauthenticated';
  email: string | null;
  token: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Wraps the app (app/_layout.tsx) so every screen can read auth state via
 * useAuth() without re-reading expo-secure-store itself. Restores a
 * persisted session on mount (TAPS-6.2) — the whole point of storing the
 * token at all is that a user who logged in yesterday shouldn't have to
 * log in again every time they open the app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStoredSession()
      .then((session) => {
        if (cancelled) {
          return;
        }
        if (session) {
          setEmail(session.email);
          setToken(session.accessToken);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('unauthenticated');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginEmail: string, password: string) => {
    const result = await loginRequest(loginEmail, password);
    if (result.ok) {
      setEmail(result.session.email);
      setToken(result.session.accessToken);
      setStatus('authenticated');
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await clearStoredSession();
    setEmail(null);
    setToken(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, email, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be called within an AuthProvider (see app/_layout.tsx)');
  }
  return context;
}
