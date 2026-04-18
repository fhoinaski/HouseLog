'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authApi, setToken, clearToken, type User } from './api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; password: string; role?: string; phone?: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRefresh(token: string) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const msUntilRefresh = expiry - Date.now() - 60_000; // refresh 1 min before expiry
    if (msUntilRefresh <= 0) {
      void doRefresh(token);
      return;
    }
    refreshTimerRef.current = setTimeout(() => void doRefresh(token), msUntilRefresh);
  }

  async function doRefresh(token: string) {
    try {
      const { token: newToken } = await authApi.refresh(token);
      setToken(newToken);
      localStorage.setItem('hl_token', newToken);
      scheduleRefresh(newToken);
    } catch {
      clearToken();
      setUser(null);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('hl_user');
    const token = localStorage.getItem('hl_token');
    if (stored && token) {
      const expiry = getTokenExpiry(token);
      if (expiry && expiry < Date.now()) {
        clearToken();
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
    const { token, user: u } = await authApi.login(email, password);
    setToken(token);
    localStorage.setItem('hl_user', JSON.stringify(u));
    setUser(u);
    scheduleRefresh(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(
    async (data: { email: string; name: string; password: string; role?: string; phone?: string }) => {
      const { token, user: u } = await authApi.register(data);
      setToken(token);
      localStorage.setItem('hl_user', JSON.stringify(u));
      setUser(u);
      scheduleRefresh(token);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
