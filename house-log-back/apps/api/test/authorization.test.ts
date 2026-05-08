import { describe, expect, it } from 'vitest';
import {
  canRequestDocumentIngestionDecision,
  canRequestDocumentIngestionRole,
  canSendInternalServiceMessage,
  canViewServiceMessages,
  canViewInternalServiceMessages,
  canViewProviderOpportunity,
} from '../src/lib/authorization';

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
