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
        // Evita tempestades de requisições em erros definitivos (4xx).
        // - 401: tratado pelo onError acima — não retentar (o redirect ao login já foi feito)
        // - 403: proibição permanente — retentar não vai mudar o resultado
        // - 404: recurso não existe — idem
        // - 429: rate-limit — esperar 60 s antes de uma última tentativa
        // Demais erros (5xx, rede): backoff exponencial, máx 3 tentativas
        onErrorRetry(error, _key, _config, revalidate, { retryCount }) {
          const status = (error as { status?: number })?.status;
          if (status === 401 || status === 403 || status === 404) return;
          if (status === 429) {
            if (retryCount >= 1) return;
            setTimeout(() => revalidate({ retryCount }), 60_000);
            return;
          }
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), Math.min(1_000 * 2 ** retryCount, 30_000));
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
