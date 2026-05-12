import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canApproveBudget,
  canDeleteDocument,
  canInviteUser,
  canManageProperty,
  canManageServiceOrder,
  canManageTenantUsers,
  canRequestDocumentIngestionDecision,
  canRequestDocumentIngestionRole,
  canSendInternalServiceMessage,
  canViewAuditLog,
  canRevealCredential,
  canViewServiceMessages,
  canViewInternalServiceMessages,
  canViewProviderOpportunity,
} from '../src/lib/authorization';

vi.mock('../src/db/client', () => ({
  getDb: vi.fn((db: unknown) => db),
}));

function createDb(responses: Array<Array<Record<string, unknown>>>) {
  const queue = [...responses];
  const limit = vi.fn(async () => queue.shift() ?? []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from })) };
}

const baseMessageInput = {
  userId: 'provider-a',
  role: 'provider' as const,
  propertyOwnerId: 'owner-a',
  propertyManagerId: 'manager-a',
  requestedById: 'owner-a',
  assignedProviderId: 'provider-b',
};

describe('service message authorization', () => {
  it('blocks provider without assignment, bid, or property access', () => {
    expect(canViewServiceMessages(baseMessageInput)).toBe(false);
  });

  it('allows provider with active bid to access the service chat', () => {
    expect(canViewServiceMessages({ ...baseMessageInput, hasActiveProviderBid: true })).toBe(true);
  });

  it('does not allow provider to view or send internal messages', () => {
    expect(canViewInternalServiceMessages(baseMessageInput)).toBe(false);
    expect(canSendInternalServiceMessage(baseMessageInput)).toBe(false);
  });

  it('allows tenant-side participants to view internal messages', () => {
    const ownerInput = { ...baseMessageInput, userId: 'owner-a', role: 'owner' as const };

    expect(canViewServiceMessages(ownerInput)).toBe(true);
    expect(canViewInternalServiceMessages(ownerInput)).toBe(true);
  });
});

describe('canRequestDocumentIngestionRole', () => {
  it('allows admin with active tenant context', () => {
    expect(canRequestDocumentIngestionRole({ role: 'admin', tenantId: 't1' })).toBe(true);
  });

  it('allows global owner with active tenant context', () => {
    expect(canRequestDocumentIngestionRole({ role: 'owner', tenantId: 't1' })).toBe(true);
  });

  it('allows tenant owner with tenantId and tenantRole:owner', () => {
    expect(canRequestDocumentIngestionRole({ role: 'owner', tenantId: 't1', tenantRole: 'owner' })).toBe(true);
  });

  it('allows tenant manager with active tenant context', () => {
    expect(canRequestDocumentIngestionRole({ role: 'owner', tenantId: 't1', tenantRole: 'manager' })).toBe(true);
  });

  it('blocks provider role unconditionally', () => {
    expect(canRequestDocumentIngestionRole({ role: 'provider', tenantId: 't1', tenantRole: 'owner' })).toBe(false);
  });

  it('blocks temp_provider role unconditionally', () => {
    expect(canRequestDocumentIngestionRole({ role: 'temp_provider', tenantId: 't1', tenantRole: 'owner' })).toBe(false);
  });

  it('blocks owner without tenantId', () => {
    expect(canRequestDocumentIngestionRole({ role: 'owner', tenantId: null, tenantRole: 'owner' })).toBe(false);
  });

  it('blocks admin without tenantId', () => {
    expect(canRequestDocumentIngestionRole({ role: 'admin', tenantId: null })).toBe(false);
  });

  it('keeps global owner allowed even without tenantRole when tenant is active', () => {
    expect(canRequestDocumentIngestionRole({ role: 'owner', tenantId: 't1', tenantRole: null })).toBe(true);
  });

  it('blocks provider even with tenantRole:owner', () => {
    expect(canRequestDocumentIngestionRole({ role: 'provider', tenantId: 't1', tenantRole: 'owner' })).toBe(false);
  });
});

describe('canRequestDocumentIngestionDecision', () => {
  it('allows admin with property access', () => {
    expect(canRequestDocumentIngestionDecision({ role: 'admin', tenantId: 't1', hasPropertyAccess: true })).toBe(true);
  });

  it('allows global owner with property access', () => {
    expect(canRequestDocumentIngestionDecision({ role: 'owner', tenantId: 't1', hasPropertyAccess: true })).toBe(true);
  });

  it('allows tenant owner with property access', () => {
    expect(canRequestDocumentIngestionDecision({
      role: 'owner',
      tenantId: 't1',
      tenantRole: 'owner',
      hasPropertyAccess: true,
    })).toBe(true);
  });

  it('allows tenant manager with property access', () => {
    expect(canRequestDocumentIngestionDecision({
      role: 'owner',
      tenantId: 't1',
      tenantRole: 'manager',
      hasPropertyAccess: true,
    })).toBe(true);
  });

  it('blocks provider with property access', () => {
    expect(canRequestDocumentIngestionDecision({
      role: 'provider',
      tenantId: 't1',
      tenantRole: 'provider',
      hasPropertyAccess: true,
    })).toBe(false);
  });

  it('blocks temp_provider with property access', () => {
    expect(canRequestDocumentIngestionDecision({
      role: 'temp_provider',
      tenantId: 't1',
      tenantRole: 'temp_provider',
      hasPropertyAccess: true,
    })).toBe(false);
  });

  it('blocks user without active tenant', () => {
    expect(canRequestDocumentIngestionDecision({
      role: 'owner',
      tenantId: null,
      tenantRole: 'owner',
      hasPropertyAccess: true,
    })).toBe(false);
  });

  it('blocks user without property access', () => {
    expect(canRequestDocumentIngestionDecision({
      role: 'owner',
      tenantId: 't1',
      tenantRole: 'owner',
      hasPropertyAccess: false,
    })).toBe(false);
  });
});

describe('provider opportunity authorization', () => {
  it('blocks provider from already assigned service order', () => {
    expect(
      canViewProviderOpportunity({
        userId: 'provider-a',
        role: 'provider',
        assignedProviderId: 'provider-b',
        serviceOrderStatus: 'requested',
      })
    ).toBe(false);
  });

  it('allows provider to see requested opportunity matching a category', () => {
    expect(
      canViewProviderOpportunity({
        userId: 'provider-a',
        role: 'provider',
        assignedProviderId: null,
        serviceOrderStatus: 'requested',
        serviceOrderSystemType: 'plumbing',
        providerCategories: ['plumbing'],
      })
    ).toBe(true);
  });
});

describe('granular tenant authorization helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks audit log access without an active tenant', () => {
    expect(canViewAuditLog({ tenantId: null, tenantRole: 'owner' })).toEqual({
      allowed: false,
      status: 400,
      code: 'TENANT_REQUIRED',
    });
  });

  it('allows owners to view the audit log', () => {
    expect(canViewAuditLog({ tenantId: 'tenant-a', tenantRole: 'owner' })).toEqual({ allowed: true });
  });

  it('rejects delete document when the property is outside the active tenant', async () => {
    const db = createDb([[]]);

    await expect(
      canDeleteDocument(db as never, {
        propertyId: 'property-a',
        userId: 'user-a',
        role: 'owner',
        tenantId: 'tenant-a',
        tenantRole: 'owner',
      })
    ).resolves.toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows property managers to manage service orders and budgets', async () => {
    await expect(
      canManageServiceOrder(createDb([
        [{ tenantId: 'tenant-a', ownerId: 'owner-a', managerId: 'manager-a' }],
        [{ tenantId: 'tenant-a', role: 'manager', canOpenOs: 1 }],
      ]) as never, {
        propertyId: 'property-a',
        userId: 'manager-a',
        role: 'owner',
        tenantId: 'tenant-a',
        tenantRole: 'manager',
      })
    ).resolves.toEqual({ allowed: true, reason: 'tenant_manager' });

    await expect(
      canApproveBudget(createDb([
        [{ tenantId: 'tenant-a', ownerId: 'owner-a', managerId: 'manager-a' }],
        [{ tenantId: 'tenant-a', role: 'manager', canOpenOs: 1 }],
      ]) as never, {
        propertyId: 'property-a',
        userId: 'manager-a',
        role: 'owner',
        tenantId: 'tenant-a',
        tenantRole: 'manager',
      })
    ).resolves.toEqual({ allowed: true, reason: 'tenant_manager' });
  });

  it('allows revealing credentials only when the property relation is direct', async () => {
    const db = createDb([[{ tenantId: 'tenant-a', ownerId: 'owner-a', managerId: 'manager-a' }], []]);

    await expect(
      canRevealCredential(db as never, {
        propertyId: 'property-a',
        userId: 'manager-a',
        role: 'owner',
        tenantId: 'tenant-a',
        tenantRole: 'manager',
      })
    ).resolves.toEqual({ allowed: true, reason: 'direct_property_secret' });
  });

  it('allows tenant owners to manage collaborators and invites', async () => {
    await expect(
      canManageTenantUsers(createDb([[{ tenantId: 'tenant-a', ownerId: 'owner-a', managerId: null }], []]) as never, {
        propertyId: 'property-a',
        userId: 'owner-a',
        role: 'owner',
        tenantId: 'tenant-a',
        tenantRole: 'owner',
      })
    ).resolves.toEqual({ allowed: true, reason: 'tenant_owner' });

    await expect(
      canInviteUser(createDb([[{ tenantId: 'tenant-a', ownerId: 'owner-a', managerId: null }], []]) as never, {
        propertyId: 'property-a',
        userId: 'owner-a',
        role: 'owner',
        tenantId: 'tenant-a',
        tenantRole: 'owner',
      })
    ).resolves.toEqual({ allowed: true, reason: 'tenant_owner' });
  });

  it('blocks tenant-less inputs in property helpers', async () => {
    await expect(
      canManageProperty(createDb([]) as never, {
        propertyId: 'property-a',
        userId: 'user-a',
        role: 'owner',
        tenantId: null,
        tenantRole: 'owner',
      })
    ).resolves.toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });
});
