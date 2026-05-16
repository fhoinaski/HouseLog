'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authApi, setToken, clearToken, isMfaChallenge, type User } from './api';
import { clearLegacyAuthStorage } from './api/core/storage';
import { clearOfflineStateForLogout } from './auth-logout-cleanup';

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
  register: (data: {
    email: string;
    name: string;
    password: string;
    role?: string;
    phone?: string;
    whatsapp?: string;
    service_area?: string;
    pix_key?: string;
    pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    provider_bio?: string;
    provider_courses?: string[];
    provider_specializations?: string[];
    provider_portfolio?: string[];
    provider_education?: Array<{
      institution: string;
      title: string;
      type: 'college' | 'technical' | 'course' | 'certification' | 'other';
      status: 'in_progress' | 'completed';
      certificationUrl?: string;
    }>;
    provider_portfolio_cases?: Array<{
      title: string;
      description?: string;
      beforeImageUrl?: string;
      afterImageUrl?: string;
    }>;
    provider_categories?: string[];
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

// User profile is kept in localStorage for optimistic UI on page reload.
// The access token is NEVER stored in localStorage — it lives in module memory only.
const USER_KEY = 'hl_user';

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function storeSession(access: string, user?: User) {
  setToken(access); // in-memory only — never touches localStorage
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAll() {
  clearToken();
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRefresh = useCallback(async () => {
    try {
      const { access_token } = await authApi.refresh();
      setToken(access_token);
      const stored = localStorage.getItem(USER_KEY);
      if (stored) {
        const parsedUser = JSON.parse(stored) as User;
        setUser(parsedUser);
      }
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
    const cleanup = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };

    // One-time migration: remove any legacy hl_token left in localStorage by older app versions.
    clearLegacyAuthStorage();

    // Pre-populate the user profile for instant UI — no auth dependency.
    // The actual access token must always come from the HttpOnly cookie via refresh.
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored) as User);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }

    // Always bootstrap the access token from the HttpOnly refresh cookie.
    // Access tokens are ephemeral (in-memory only) and are lost on page reload.
    void doRefresh().finally(() => setLoading(false));

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await authApi.login(email, password);
    if (isMfaChallenge(resp)) {
      throw new MfaRequiredError(resp.challenge_token);
    }
    storeSession(resp.access_token, resp.user);
    setUser(resp.user);
    scheduleRefresh(resp.access_token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeMfa = useCallback(async (challengeToken: string, code: string) => {
    const resp = await authApi.mfaChallenge(challengeToken, code);
    storeSession(resp.access_token, resp.user);
    setUser(resp.user);
    scheduleRefresh(resp.access_token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      name: string;
      password: string;
      role?: string;
      phone?: string;
      whatsapp?: string;
      service_area?: string;
      pix_key?: string;
      pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
      provider_bio?: string;
      provider_courses?: string[];
      provider_specializations?: string[];
      provider_portfolio?: string[];
      provider_education?: Array<{
        institution: string;
        title: string;
        type: 'college' | 'technical' | 'course' | 'certification' | 'other';
        status: 'in_progress' | 'completed';
        certificationUrl?: string;
      }>;
      provider_portfolio_cases?: Array<{
        title: string;
        description?: string;
        beforeImageUrl?: string;
        afterImageUrl?: string;
      }>;
      provider_categories?: string[];
    }) => {
      const resp = await authApi.register(data);
      storeSession(resp.access_token, resp.user);
      setUser(resp.user);
      scheduleRefresh(resp.access_token);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Cookie revogado server-side; fire-and-forget
    void authApi.logout().catch(() => {});

    // Lê o userId do localStorage antes de limpar — o callback não fecha sobre user state
    // porque tem deps=[]. O localStorage ainda contém o perfil neste momento.
    const stored = localStorage.getItem(USER_KEY);
    const currentUser = stored
      ? (() => { try { return JSON.parse(stored) as User; } catch { return null; } })()
      : null;

    void clearOfflineStateForLogout(currentUser).catch(() => {});

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
