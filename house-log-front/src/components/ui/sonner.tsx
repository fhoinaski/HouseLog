'use client';
import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from 'next-themes';

export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      theme={theme as 'light' | 'dark' | 'system' | undefined}
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-[var(--card)] group-[.toaster]:text-[var(--foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--muted-foreground)]',
          actionButton: 'group-[.toast]:bg-primary-600 group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-[var(--muted)] group-[.toast]:text-[var(--muted-foreground)]',
        },
      }}
    />
  );
}
