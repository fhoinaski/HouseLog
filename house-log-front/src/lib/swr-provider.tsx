'use client';

import { useMemo } from 'react';
import { SWRConfig, type Cache } from 'swr';
import { clearToken } from './api';
import { createIDBCacheProvider } from './idb-cache';

let redirecting = false;

export function handle401(): void {
  if (redirecting) return;
  redirecting = true;
  clearToken();
  window.location.href = '/login';
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  // Create once per mount — stable reference required by SWR
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = useMemo<((cache: Readonly<Cache<any>>) => Cache<any>) | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createIDBCacheProvider() as unknown as (cache: Readonly<Cache<any>>) => Cache<any>;
  }, []);

  return (
    <SWRConfig
      value={{
        provider,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
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
