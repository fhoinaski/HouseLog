'use client';

/**
 * Hook de sincronização para a fila offline unificada (offline-queue.ts).
 *
 * Regras:
 * - Nunca armazena token no IDB — lido da memória no momento do upload.
 * - Não inicia sync sem token ou sem tenantId/userId.
 * - Apenas um ciclo de sync por vez (mutex via syncingRef).
 * - Sync automática ao recuperar conexão (evento 'online').
 * - Retry com backoff exponencial: getNextRetryDelay(attempts).
 * - Falha de upload preserva o item — não apaga, apenas muda status para 'failed'.
 *
 * Uso:
 *   const { pendingCount, failedCount, isSyncing, sync } = useOfflineQueueSync(tenantId, userId);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearByUser,
  clearByUserAcrossTenants,
  clearSyncedByUser,
  getPendingByUser,
  getNextRetryDelay,
  updateItem,
  type OqItem,
  type OqPhotoItem,
} from './offline-queue';
import { getToken } from './api/core/storage';

const API_BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL?.trim() ?? 'http://localhost:8787/api/v1')
    : 'http://localhost:8787/api/v1';

// ── Upload de foto ────────────────────────────────────────────────────────────

async function uploadPhoto(item: OqPhotoItem, token: string): Promise<void> {
  const fd = new FormData();
  fd.append('file', new File([item.file], item.filename, { type: item.mimeType }));
  fd.append('type', item.evidenceType);
  const res = await fetch(
    `${API_BASE}/properties/${item.propertyId}/services/${item.serviceOrderId}/photos`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro no upload' }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

// ── Upload de rascunho de OS ──────────────────────────────────────────────────

async function uploadOsUpdate(
  item: Extract<OqItem, { type: 'os-update' }>,
  token: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/properties/${item.propertyId}/services/${item.serviceOrderId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(item.patch),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro ao salvar OS' }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

// ── Processamento da fila — função pura exportada para testes ─────────────────

/**
 * Processa todos os itens pendentes/falhos do tenant+usuário.
 * Função pura — sem estado React — para facilitar testes unitários.
 */
export async function processPendingItems(
  tenantId: string,
  userId: string,
  token: string
): Promise<void> {
  const items = await getPendingByUser(tenantId, userId);

  for (const item of items) {
    const now = new Date().toISOString();
    try {
      await updateItem(item.id, { status: 'uploading', lastAttemptAt: now });

      if (item.type === 'photo-upload') {
        await uploadPhoto(item, token);
      } else {
        await uploadOsUpdate(item, token);
      }

      await updateItem(item.id, { status: 'synced' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      await updateItem(item.id, {
        status: 'failed',
        attempts: item.attempts + 1,
        errorMessage: msg,
        lastAttemptAt: now,
      });
    }
  }

  await clearSyncedByUser(tenantId, userId);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type OfflineQueueSyncState = {
  /** Total de itens pendentes + com falha para o tenant+usuário. */
  pendingCount: number;
  /** Número de itens com falha que precisam de retry. */
  failedCount: number;
  /** Número de itens com status 'photo-upload' pendentes. */
  photoPendingCount: number;
  /** Número de itens com status 'os-update' pendentes. */
  osUpdatePendingCount: number;
  /** true enquanto um ciclo de sync está em andamento. */
  isSyncing: boolean;
  /** Dispara sync manual. Seguro chamar múltiplas vezes — o mutex previne concorrência. */
  sync: () => Promise<void>;
};

/**
 * Hook para controlar a sincronização da fila offline do tenant+usuário.
 *
 * @param tenantId - ID do tenant ativo. Null/undefined desabilita a sync.
 * @param userId   - ID do usuário autenticado. Null/undefined desabilita a sync.
 */
export function useOfflineQueueSync(
  tenantId: string | null | undefined,
  userId: string | null | undefined
): OfflineQueueSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [photoPendingCount, setPhotoPendingCount] = useState(0);
  const [osUpdatePendingCount, setOsUpdatePendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    if (!tenantId || !userId) return;
    if (typeof indexedDB === 'undefined') return;
    try {
      const pending = await getPendingByUser(tenantId, userId);
      setPendingCount(pending.length);
      setFailedCount(pending.filter((i) => i.status === 'failed').length);
      setPhotoPendingCount(pending.filter((i) => i.type === 'photo-upload').length);
      setOsUpdatePendingCount(pending.filter((i) => i.type === 'os-update').length);
    } catch {
      // IDB indisponível — estado permanece
    }
  }, [tenantId, userId]);

  const sync = useCallback(async () => {
    if (!tenantId || !userId) return;
    if (syncingRef.current) return;
    const token = getToken();
    if (!token) return;
    if (typeof indexedDB === 'undefined') return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await processPendingItems(tenantId, userId, token);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshCounts();
    }
  }, [tenantId, userId, refreshCounts]);

  // Atualiza contadores na montagem e quando tenant/usuário muda
  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  // Sync automática ao recuperar conexão
  useEffect(() => {
    const handleOnline = () => void sync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [sync]);

  return {
    pendingCount,
    failedCount,
    photoPendingCount,
    osUpdatePendingCount,
    isSyncing,
    sync,
  };
}

/**
 * Limpa toda a fila do tenant+usuário.
 * Deve ser chamado no logout — passando tenantId e userId do usuário que está saindo.
 */
export async function clearOfflineQueueByUser(
  tenantId: string | null | undefined,
  userId: string | null | undefined
): Promise<void> {
  if (!tenantId || !userId) return;
  if (typeof indexedDB === 'undefined') return;
  try {
    await clearByUser(tenantId, userId);
  } catch {
    // IDB indisponível — falha silenciosa no logout
  }
}

/**
 * Fallback explicito para logout quando o tenantId ativo nao esta disponivel.
 * Remove somente itens do userId informado, preservando filas de outros usuarios.
 */
export async function clearOfflineQueueForUserAcrossTenants(
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;
  if (typeof indexedDB === 'undefined') return;
  try {
    await clearByUserAcrossTenants(userId);
  } catch {
    // IDB indisponivel — falha silenciosa no logout
  }
}

/**
 * Calcula o delay recomendado antes do próximo retry para um item com N tentativas.
 * Re-exportado para uso em componentes sem importar offline-queue diretamente.
 */
export { getNextRetryDelay };
