'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, setToken, clearToken, type User } from './api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; password: string; role?: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hl_user');
    const token = localStorage.getItem('hl_token');
    if (stored && token) {
      setUser(JSON.parse(stored) as User);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authApi.login(email, password);
    setToken(token);
    localStorage.setItem('hl_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const register = useCallback(
    async (data: { email: string; name: string; password: string; role?: string }) => {
      const { token, user: u } = await authApi.register(data);
      setToken(token);
      localStorage.setItem('hl_user', JSON.stringify(u));
      setUser(u);
    },
    []
  );

  const logout = useCallback(() => {
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
