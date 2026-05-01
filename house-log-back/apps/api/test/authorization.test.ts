import { describe, expect, it } from 'vitest';
import {
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
