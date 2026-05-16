import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { clearOfflineStateForLogout } from '../lib/auth-logout-cleanup';
import { idbGet, idbSet } from '../lib/idb-cache';
import {
  _resetDb,
  enqueue,
  getByUser,
  type OqPhotoItem,
} from '../lib/offline-queue';
import type { User } from '../lib/api';

type PhotoInput = Omit<OqPhotoItem, 'id' | 'status' | 'attempts' | 'createdAt'>;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User One',
    role: 'owner',
    phone: null,
    avatar_url: null,
    created_at: '2026-05-15T00:00:00.000Z',
    last_login: null,
    ...overrides,
  };
}

function makePhoto(overrides: Partial<PhotoInput> = {}): PhotoInput {
  return {
    type: 'photo-upload',
    tenantId: 'tenant-a',
    userId: 'user-1',
    propertyId: 'prop-1',
    serviceOrderId: 'os-1',
    evidenceType: 'before',
    filename: 'foto.jpg',
    mimeType: 'image/jpeg',
    file: new Blob(['foto'], { type: 'image/jpeg' }),
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  _resetDb();
});

describe('clearOfflineStateForLogout', () => {
  it('com tenantId valido limpa apenas a fila daquele tenant/user e limpa cache SWR', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-1', filename: 'mine-a.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-1', filename: 'mine-b.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-2', filename: 'other-user.jpg' }));
    await idbSet('inventory:prop-1', { cached: true });

    await clearOfflineStateForLogout(makeUser({ active_tenant_id: 'tenant-a' }));

    expect(await getByUser('tenant-a', 'user-1')).toHaveLength(0);
    expect(await getByUser('tenant-b', 'user-1')).toHaveLength(1);
    expect(await getByUser('tenant-a', 'user-2')).toHaveLength(1);
    expect(await idbGet('inventory:prop-1')).toBeUndefined();
  });

  it('sem tenantId confiavel usa fallback por userId sem limpar outro usuario', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-1', filename: 'mine-a.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-1', filename: 'mine-b.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-2', filename: 'other-user.jpg' }));

    await clearOfflineStateForLogout(makeUser());

    expect(await getByUser('tenant-a', 'user-1')).toHaveLength(0);
    expect(await getByUser('tenant-b', 'user-1')).toHaveLength(0);
    expect(await getByUser('tenant-a', 'user-2')).toHaveLength(1);
  });
});
