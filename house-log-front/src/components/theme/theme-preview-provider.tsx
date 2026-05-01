'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'hl_visual_theme_preview';

export const VISUAL_THEME_OPTIONS = [
  { value: 'current', label: 'Atual' },
  { value: 'crm-premium', label: 'CRM premium' },
  { value: 'crm-premium-dark', label: 'CRM premium dark' },
] as const;

export type VisualThemePreview = (typeof VISUAL_THEME_OPTIONS)[number]['value'];

type VisualThemePreviewContextValue = {
  theme: VisualThemePreview;
  setTheme: (theme: VisualThemePreview) => void;
};

const VisualThemePreviewContext = createContext<VisualThemePreviewContextValue | null>(null);

function isVisualThemePreview(value: string | null): value is VisualThemePreview {
  return VISUAL_THEME_OPTIONS.some((option) => option.value === value);
}

function applyThemePreview(theme: VisualThemePreview) {
  const root = document.documentElement;
  const body = document.body;

  if (theme === 'current') {
    root.removeAttribute('data-theme');
    body.removeAttribute('data-theme');
    return;
  }

  root.dataset.theme = theme;
  body.dataset.theme = theme;
}

export function ThemePreviewProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<VisualThemePreview>('current');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY);
      const initialTheme = isVisualThemePreview(storedTheme) ? storedTheme : 'current';

      setThemeState(initialTheme);
      applyThemePreview(initialTheme);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const setTheme = useCallback((nextTheme: VisualThemePreview) => {
    setThemeState(nextTheme);
    applyThemePreview(nextTheme);

    if (nextTheme === 'current') {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  const value = useMemo<VisualThemePreviewContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <VisualThemePreviewContext.Provider value={value}>
      {children}
    </VisualThemePreviewContext.Provider>
  );
}

export function useVisualThemePreview() {
  const context = useContext(VisualThemePreviewContext);

  if (!context) {
    throw new Error('useVisualThemePreview must be used within ThemePreviewProvider');
  }

  return context;
}
