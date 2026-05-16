import type { User } from './api';
import { clearIDBCache } from './idb-cache';
import { clearOfflineQueue } from './use-offline-sync';
import {
  clearOfflineQueueByUser,
  clearOfflineQueueForUserAcrossTenants,
} from './use-offline-queue-sync';

export function getUserTenantIdForOfflineCleanup(user: User | null): string | null {
  if (!user) return null;
  return user.active_tenant_id ?? user.activeTenantId ?? null;
}

export async function clearOfflineStateForLogout(user: User | null): Promise<void> {
  const userId = user?.id ?? null;
  const tenantId = getUserTenantIdForOfflineCleanup(user);

  await Promise.allSettled([
    tenantId && userId
      ? clearOfflineQueueByUser(tenantId, userId)
      : clearOfflineQueueForUserAcrossTenants(userId),
    clearOfflineQueue(),
    clearIDBCache(),
  ]);
}
