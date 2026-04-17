'use client';

import { SWRConfig } from 'swr';
import { clearToken } from './api';

// Module-level flag prevents multiple simultaneous 401s from causing a redirect storm
let redirecting = false;

export function handle401(): void {
  if (redirecting) return;
  redirecting = true;
  clearToken();
  window.location.href = '/login';
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        onError(error: unknown) {
          if ((error as { status?: number })?.status === 401) {
            handle401();
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
