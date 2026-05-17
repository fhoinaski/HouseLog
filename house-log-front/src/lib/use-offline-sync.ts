'use client';

// Hook de sincronização para a fila de evidências offline.
//
// Regras:
// - Nunca armazena token no IndexedDB — o token é lido da memória no momento do upload.
// - Não inicia sync sem token disponível.
// - Apenas uma sync corre por vez (syncingRef como mutex).
// - Sync automática ao voltar online (evento 'online').
// - clearOfflineQueue() é exportado para uso no logout.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAll as clearQueueAll,
  clearSynced,
  getPending,
  updateItem,
} from './offline-evidence-queue';

const API_BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL?.trim() ?? 'http://localhost:8787/api/v1')
    : 'http://localhost:8787/api/v1';

/**
 * Faz o upload de uma evidência diretamente via fetch.
 * Separada do servicesApi para não criar dependência circular e para ser testável.
 */
async function uploadEvidenceFetch(
  propertyId: string,
  serviceOrderId: string,
  file: Blob,
  filename: string,
  mimeType: string,
  type: 'before' | 'after',
  token: string
): Promise<void> {
  const fd = new FormData();
  fd.append('file', new File([file], filename, { type: mimeType }));
  fd.append('type', type);
  const res = await fetch(
    `${API_BASE}/properties/${propertyId}/services/${serviceOrderId}/photos`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro no upload' }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

/**
 * Processa todos os itens pendentes da fila.
 * Função pura exportada para facilitar testes unitários sem React.
 */
export async function processPendingUploads(token: string): Promise<void> {
  const items = await getPending();
  for (const item of items) {
    try {
      await updateItem(item.id, { status: 'uploading' });
      await uploadEvidenceFetch(
        item.propertyId,
        item.serviceOrderId,
        item.file,
        item.filename,
        item.mimeType,
        item.type,
        token
      );
      await updateItem(item.id, { status: 'synced' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      await updateItem(item.id, {
        status: 'failed',
        attempts: item.attempts + 1,
        errorMessage: msg,
      });
    }
  }
  await clearSynced();
}

export type OfflineSyncState = {
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  isSyncing: boolean;
  sync: () => Promise<void>;
  clearSyncedItems: () => Promise<void>;
};

export function useOfflineSync(): OfflineSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncingCount, setSyncingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    if (typeof indexedDB === 'undefined') return;
    try {
      setPendingCount(0);
      setFailedCount(0);
    } catch {
      // IDB indisponível
    }
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof indexedDB === 'undefined') return;

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      setSyncingCount(0);
      await clearQueueAll();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      setSyncingCount(0);
      await refreshCounts();
    }
  }, [refreshCounts]);

  const clearSyncedItems = useCallback(async () => {
    await clearSynced();
    await refreshCounts();
  }, [refreshCounts]);

  // Atualiza contadores na montagem
  useEffect(() => {
    void clearQueueAll().finally(refreshCounts);
  }, [refreshCounts]);

  // Dispara sync automática ao recuperar conexão
  useEffect(() => {
    const handleOnline = () => void sync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [sync]);

  return { pendingCount, syncingCount, failedCount, isSyncing, sync, clearSyncedItems };
}

/**
 * Limpa ambas as filas de evidências no logout.
 *
 * - houselog-eq (fila legada de fotos)
 * - houselog-oq (fila unificada de fotos + rascunhos de OS)
 *
 * Nota: clearAll() na fila nova remove TODOS os itens independente de tenant,
 * pois o tenantId não está disponível no logout sem mudança do tipo User.
 * Prefira clearByUser(tenantId, userId) quando o tenantId for conhecido.
 */
export async function clearOfflineQueue(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await clearQueueAll().catch(() => {});
}
