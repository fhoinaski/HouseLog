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
  OFFLINE_QUEUE_MAX_ATTEMPTS,
  clearByUser,
  clearByUserAcrossTenants,
  clearSyncedByUser,
  getManualActionByUser,
  getPendingByUser,
  getNextRetryDelay,
  manualActionReason,
  requiresManualAction,
  updateItem,
  type OqItem,
  type OqPhotoItem,
} from './offline-queue';
import { clearAll as clearLegacyEvidenceQueue } from './offline-evidence-queue';
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
  const url = item.useProviderRoute
    ? `${API_BASE}/provider/services/${item.serviceOrderId}/photos`
    : `${API_BASE}/properties/${item.propertyId}/services/${item.serviceOrderId}/photos`;
  const res = await fetch(
    url,
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
  const nowMs = Date.now();

  for (const item of items) {
    if (requiresManualAction(item, nowMs)) {
      await updateItem(item.id, {
        status: 'requires_action',
        errorMessage: manualActionReason(item, nowMs),
      });
      continue;
    }

    if (item.status === 'failed' && item.lastAttemptAt) {
      const lastAttemptAt = Date.parse(item.lastAttemptAt);
      const retryAt = Number.isFinite(lastAttemptAt)
        ? lastAttemptAt + getNextRetryDelay(item.attempts)
        : nowMs;
      if (retryAt > nowMs) continue;
    }

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
      const attempts = item.attempts + 1;
      const status = attempts >= OFFLINE_QUEUE_MAX_ATTEMPTS ? 'requires_action' : 'failed';
      await updateItem(item.id, {
        status,
        attempts,
        errorMessage: status === 'requires_action'
          ? manualActionReason({ ...item, attempts }, nowMs)
          : msg,
        lastAttemptAt: now,
      });
    }
  }

  await clearSyncedByUser(tenantId, userId);
}

export async function clearLegacyOfflineEvidenceQueue(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await clearLegacyEvidenceQueue().catch(() => {});
}

export async function syncOfflineQueueOnce(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
  token: string | null
): Promise<boolean> {
  if (!tenantId || !userId || !token) return false;
  if (typeof indexedDB === 'undefined') return false;
  await processPendingItems(tenantId, userId, token);
  return true;
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
  requiresActionCount: number;
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
  const [requiresActionCount, setRequiresActionCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    if (!tenantId || !userId) return;
    if (typeof indexedDB === 'undefined') return;
    try {
      const pending = await getPendingByUser(tenantId, userId);
      const manual = await getManualActionByUser(tenantId, userId);
      setPendingCount(pending.length);
      setFailedCount(pending.filter((i) => i.status === 'failed').length);
      setPhotoPendingCount(pending.filter((i) => i.type === 'photo-upload').length);
      setOsUpdatePendingCount(pending.filter((i) => i.type === 'os-update').length);
      setRequiresActionCount(manual.length);
    } catch {
      // IDB indisponível — estado permanece
    }
  }, [tenantId, userId]);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const token = getToken();

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncOfflineQueueOnce(tenantId, userId, token);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshCounts();
    }
  }, [tenantId, userId, refreshCounts]);

  // Atualiza contadores na montagem e quando tenant/usuário muda
  useEffect(() => {
    void refreshCounts();
    void clearLegacyOfflineEvidenceQueue();
    void sync();
  }, [refreshCounts, sync]);

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
    requiresActionCount,
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
