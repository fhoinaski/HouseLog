'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-neutral-50)">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--hl-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-medium text-(--hl-text-primary)">Sem conexão</h1>
        <p className="mt-1 max-w-xs text-sm text-(--hl-text-secondary)">
          Você está offline. Dados em cache ainda podem ser consultados.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 min-h-11 rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95 active:scale-[0.98]"
      >
        Tentar novamente
      </button>
    </div>
  );
}
