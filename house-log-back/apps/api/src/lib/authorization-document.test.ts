import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../db/client';
import { canAccessDocument } from './authorization';

const subject = {
  propertyId: 'prop-1',
  documentId: 'doc-1',
  userId: 'user-1',
  role: 'owner' as const,
  tenantId: 'tenant-a',
  tenantRole: 'owner' as const,
};

function dbWithSelectResults(results: unknown[][]) {
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

describe('canAccessDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a document scoped to the active tenant and property', async () => {
    const db = dbWithSelectResults([
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [{ serviceId: null }],
    ]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(canAccessDocument({} as D1Database, subject)).resolves.toEqual({
      allowed: true,
      reason: 'document_property_access',
    });
  });

  it('hides a document when the parent service order is outside tenant/property scope', async () => {
    const db = dbWithSelectResults([
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [{ serviceId: 'os-cross-tenant' }],
      [],
    ]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(canAccessDocument({} as D1Database, subject)).resolves.toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('does not read document rows when property is outside the active tenant', async () => {
    const db = dbWithSelectResults([[]]);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(canAccessDocument({} as D1Database, subject)).resolves.toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
