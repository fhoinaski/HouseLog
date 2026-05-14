'use client';

import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import type { OfflineSyncState } from '@/lib/use-offline-sync';
import { cn } from '@/lib/utils';

type Props = {
  state: OfflineSyncState;
  className?: string;
};

/**
 * Indicador compacto de sincronização da fila de evidências offline.
 *
 * Exibe:
 * - Nada quando não há itens pendentes/falhos e não está sincronizando.
 * - Ícone animado + contagem enquanto sincroniza.
 * - Badge de alerta quando há falhas.
 * - Badge informativo quando há pendentes sem estar sincronizando.
 */
export function OfflineSyncStatus({ state, className }: Props) {
  const { pendingCount, syncingCount, failedCount, isSyncing, sync } = state;

  if (!isSyncing && pendingCount === 0 && failedCount === 0) return null;

  if (isSyncing) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-bg-info px-3 py-1 text-xs font-medium text-text-info',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>
          {syncingCount > 0
            ? `Enviando ${syncingCount} ${syncingCount === 1 ? 'foto' : 'fotos'}…`
            : 'Sincronizando…'}
        </span>
      </div>
    );
  }

  if (failedCount > 0) {
    return (
      <button
        type="button"
        onClick={() => void sync()}
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-bg-warning px-3 py-1 text-xs font-medium text-text-warning transition-opacity hover:opacity-80',
          className
        )}
        aria-label={`${failedCount} ${failedCount === 1 ? 'foto com falha' : 'fotos com falha'} — clique para tentar novamente`}
      >
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        <span>
          {failedCount} {failedCount === 1 ? 'falha' : 'falhas'} — tentar novamente
        </span>
      </button>
    );
  }

  // Pendentes aguardando conexão
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full bg-bg-surface px-3 py-1 text-xs font-medium text-text-secondary',
        className
      )}
      role="status"
    >
      <UploadCloud className="h-3.5 w-3.5" aria-hidden />
      <span>
        {pendingCount} {pendingCount === 1 ? 'foto offline' : 'fotos offline'}
      </span>
    </div>
  );
}
