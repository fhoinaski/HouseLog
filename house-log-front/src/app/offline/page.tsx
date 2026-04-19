'use client';

import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="safe-top safe-bottom flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-page p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-subtle">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Sem conexão</h1>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          Você está offline. Dados em cache ainda podem ser consultados.
        </p>
      </div>
      <Button onClick={() => window.location.reload()} className="mt-2">
        Tentar novamente
      </Button>
    </div>
  );
}
