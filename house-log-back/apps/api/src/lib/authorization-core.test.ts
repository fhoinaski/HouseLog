import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../db/client';
import { canAccessProperty, canCreateServiceOrder, canCreateServiceRequest } from './authorization';
import type { Role, TenantRole } from './types';

type SelectDb = {
  select: ReturnType<typeof vi.fn>;
};

function dbWithSelectResults(results: unknown[][]): SelectDb {
  const queue = [...results];
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => queue.shift() ?? []),
        })),
      })),
    })),
  };
}

function subject(overrides: Partial<{
  propertyId: string;
  userId: string;
  role: Role;
  tenantId: string | null;
  tenantRole: TenantRole | null;
}> = {}) {
  return {
    propertyId: 'prop-1',
    userId: 'user-1',
    role: 'owner' as Role,
    tenantId: 'tenant-a',
    tenantRole: 'owner' as TenantRole,
    ...overrides,
  };
}

describe('authorization core tenant enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows property access through the tenant-aware helper', async () => {
    const db = dbWithSelectResults([
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
    ]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(canAccessProperty({} as D1Database, subject())).resolves.toBe(true);
  });

  it('denies access when the role has no property permission', async () => {
    const db = dbWithSelectResults([
      [{ tenantId: 'tenant-a', ownerId: 'owner-1', managerId: null }],
      [],
    ]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(
      canAccessProperty({} as D1Database, subject({ role: 'provider', userId: 'provider-1' }))
    ).resolves.toBe(false);
  });

  it('denies cross-tenant properties without falling back to legacy id-only checks', async () => {
    const db = dbWithSelectResults([[]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(canCreateServiceOrder({} as D1Database, subject())).resolves.toBe(false);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('denies invalid parent property ids', async () => {
    const db = dbWithSelectResults([[]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(
      canCreateServiceRequest({} as D1Database, subject({ propertyId: 'prop-missing' }))
    ).resolves.toBe(false);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('denies service creation when tenant context is missing and does not query legacy paths', async () => {
    const db = dbWithSelectResults([]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(
      canCreateServiceOrder({} as D1Database, subject({ tenantId: null, tenantRole: null }))
    ).resolves.toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });
});
