'use client';

import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import type { OfflineSyncState } from '@/lib/use-offline-sync';
import type { OfflineQueueSyncState } from '@/lib/use-offline-queue-sync';
import { cn } from '@/lib/utils';

type Props = {
  state: OfflineSyncState;
  /**
   * Estado da nova fila unificada (foto + rascunho de OS).
   * Opcional para compatibilidade com uso legado que ainda não integrou a nova fila.
   */
  queueState?: OfflineQueueSyncState;
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
export function OfflineSyncStatus({ state, queueState, className }: Props) {
  const { pendingCount: legacyPending, syncingCount, failedCount: legacyFailed, isSyncing: legacySyncing, sync } = state;

  // Agrega counts da nova fila unificada (foto + OS) se disponível
  const extraPending = queueState?.pendingCount ?? 0;
  const extraFailed = queueState?.failedCount ?? 0;
  const extraSyncing = queueState?.isSyncing ?? false;
  const requiresActionCount = queueState?.requiresActionCount ?? 0;

  const pendingCount = legacyPending + extraPending;
  const failedCount = legacyFailed + extraFailed;
  const isSyncing = legacySyncing || extraSyncing;

  const handleSync = () => {
    void sync();
    if (queueState) void queueState.sync();
  };

  if (!isSyncing && pendingCount === 0 && failedCount === 0 && requiresActionCount === 0) return null;

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
            ? `Enviando ${syncingCount} ${syncingCount === 1 ? 'item' : 'itens'}…`
            : 'Sincronizando…'}
        </span>
      </div>
    );
  }

  if (failedCount > 0) {
    return (
      <button
        type="button"
        onClick={handleSync}
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-bg-warning px-3 py-1 text-xs font-medium text-text-warning transition-opacity hover:opacity-80',
          className
        )}
        aria-label={`${failedCount} ${failedCount === 1 ? 'item com falha' : 'itens com falha'} — clique para tentar novamente`}
      >
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        <span>
          {failedCount} {failedCount === 1 ? 'falha' : 'falhas'} — tentar novamente
        </span>
      </button>
    );
  }

  if (requiresActionCount > 0) {
    return (
      <button
        type="button"
        onClick={handleSync}
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-bg-warning px-3 py-1 text-xs font-medium text-text-warning transition-opacity hover:opacity-80',
          className
        )}
        aria-label={`${requiresActionCount} ${requiresActionCount === 1 ? 'item requer acao manual' : 'itens requerem acao manual'}`}
      >
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        <span>
          {requiresActionCount} {requiresActionCount === 1 ? 'requer acao' : 'requerem acao'}
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
        {pendingCount} {pendingCount === 1 ? 'item offline' : 'itens offline'}
      </span>
    </div>
  );
}
