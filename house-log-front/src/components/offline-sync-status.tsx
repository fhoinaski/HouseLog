'use client';

import { useState } from 'react';
import { AlertCircle, CloudOff, RefreshCw, RotateCcw, UploadCloud, X } from 'lucide-react';
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
 * - Painel expansível com ações por item quando há requires_action.
 * - Badge informativo quando há pendentes sem estar sincronizando.
 */
export function OfflineSyncStatus({ state, queueState, className }: Props) {
  const { pendingCount: legacyPending, syncingCount, failedCount: legacyFailed, isSyncing: legacySyncing, sync } = state;

  const [expanded, setExpanded] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const extraPending = queueState?.pendingCount ?? 0;
  const extraFailed = queueState?.failedCount ?? 0;
  const extraSyncing = queueState?.isSyncing ?? false;
  const requiresActionCount = queueState?.requiresActionCount ?? 0;
  const manualActionItems = queueState?.manualActionItems ?? [];

  const pendingCount = legacyPending + extraPending;
  const failedCount = legacyFailed + extraFailed;
  const isSyncing = legacySyncing || extraSyncing;

  const handleSync = () => {
    void sync();
    if (queueState) void queueState.sync();
  };

  const handleRetry = (id: string) => {
    if (!queueState) return;
    void queueState.retryManualItem(id);
  };

  const handleRemoveConfirm = (id: string) => {
    if (!queueState) return;
    void queueState.removeManualItem(id);
    setPendingRemoveId(null);
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

  if (requiresActionCount > 0) {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-haspopup="dialog"
          aria-label={`${requiresActionCount} ${requiresActionCount === 1 ? 'evidência requer ação manual' : 'evidências requerem ação manual'} — clique para ver detalhes`}
          onClick={() => { setExpanded((v) => !v); setPendingRemoveId(null); }}
          className="flex items-center gap-1.5 rounded-full bg-bg-error px-3 py-1 text-xs font-medium text-text-error transition-opacity hover:opacity-80"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          <span>
            {requiresActionCount} {requiresActionCount === 1 ? 'requer ação' : 'requerem ação'}
          </span>
        </button>

        {expanded && (
          <>
            {/* Backdrop para fechar ao clicar fora */}
            <div
              className="fixed inset-0 z-40"
              aria-hidden
              onClick={() => { setExpanded(false); setPendingRemoveId(null); }}
            />
            <div
              role="dialog"
              aria-label="Evidências que requerem ação manual"
              aria-modal="true"
              className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border-default bg-bg-surface p-3 shadow-lg"
            >
              <p className="mb-2 text-xs font-semibold text-text-primary">
                Algumas evidências precisam de ação manual
              </p>
              <ul className="max-h-64 overflow-y-auto space-y-2" role="list">
                {manualActionItems.map((item) => (
                  <li key={item.id} className="rounded-md border border-border-default bg-bg-base p-2">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {item.filename ?? 'Atualização de OS'}
                    </p>
                    {item.errorMessage && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-text-error">
                        {item.errorMessage}
                      </p>
                    )}
                    {pendingRemoveId === item.id ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs text-text-secondary">Confirmar remoção?</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveConfirm(item.id)}
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-text-error hover:opacity-80"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemoveId(null)}
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-text-secondary hover:opacity-80"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRetry(item.id)}
                          aria-label={`Tentar novamente: ${item.filename ?? 'Atualização de OS'}`}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-text-info hover:opacity-80"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />
                          Tentar novamente
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemoveId(item.id)}
                          aria-label={`Remover pendência: ${item.filename ?? 'Atualização de OS'}`}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-text-error hover:opacity-80"
                        >
                          <X className="h-3 w-3" aria-hidden />
                          Remover pendência
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
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
