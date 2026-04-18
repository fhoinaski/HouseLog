'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authApi, setToken, clearToken, isMfaChallenge, type User } from './api';

export class MfaRequiredError extends Error {
  challengeToken: string;
  constructor(challengeToken: string) {
    super('MFA required');
    this.name = 'MfaRequiredError';
    this.challengeToken = challengeToken;
  }
}

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeMfa: (challengeToken: string, code: string) => Promise<void>;
  register: (data: { email: string; name: string; password: string; role?: string; phone?: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const REFRESH_KEY = 'hl_refresh';
const USER_KEY = 'hl_user';
const TOKEN_KEY = 'hl_token';

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function storePair(access: string, refresh: string, user?: User) {
  setToken(access);
  localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getRefresh(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

function clearAll() {
  clearToken();
  if (typeof window !== 'undefined') localStorage.removeItem(REFRESH_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRefresh = useCallback(async () => {
    const refresh = getRefresh();
    if (!refresh) {
      clearAll();
      setUser(null);
      return;
    }
    try {
      const { access_token, refresh_token } = await authApi.refresh(refresh);
      storePair(access_token, refresh_token);
      scheduleRefresh(access_token);
    } catch {
      clearAll();
      setUser(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleRefresh(token: string) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const msUntilRefresh = expiry - Date.now() - 60_000;
    if (msUntilRefresh <= 0) {
      void doRefresh();
      return;
    }
    refreshTimerRef.current = setTimeout(() => void doRefresh(), msUntilRefresh);
  }

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    const refresh = getRefresh();
    if (stored && token) {
      const expiry = getTokenExpiry(token);
      if (expiry && expiry < Date.now()) {
        if (refresh) void doRefresh().then(() => setUser(JSON.parse(stored) as User));
        else clearAll();
      } else {
        setUser(JSON.parse(stored) as User);
        scheduleRefresh(token);
      }
    }
    setLoading(false);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await authApi.login(email, password);
    if (isMfaChallenge(resp)) {
      throw new MfaRequiredError(resp.challenge_token);
    }
    storePair(resp.access_token, resp.refresh_token, resp.user);
    setUser(resp.user);
    scheduleRefresh(resp.access_token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeMfa = useCallback(async (challengeToken: string, code: string) => {
    const resp = await authApi.mfaChallenge(challengeToken, code);
    storePair(resp.access_token, resp.refresh_token, resp.user);
    setUser(resp.user);
    scheduleRefresh(resp.access_token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(
    async (data: { email: string; name: string; password: string; role?: string; phone?: string }) => {
      const resp = await authApi.register(data);
      storePair(resp.access_token, resp.refresh_token, resp.user);
      setUser(resp.user);
      scheduleRefresh(resp.access_token);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refresh = getRefresh();
    // Fire-and-forget server-side revocation
    if (refresh) void authApi.logout(refresh).catch(() => {});
    clearAll();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeMfa, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
