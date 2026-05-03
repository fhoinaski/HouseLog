import { describe, expect, it } from 'vitest';
import {
  canAssignProviderToTenantService,
  canProviderAccessTenantServiceCycle,
  canUsePublicServiceLink,
  canUseTenantServiceOrder,
} from './service-tenant';

describe('service order tenant isolation', () => {
  it('blocks service access without an active tenant', () => {
    expect(
      canUseTenantServiceOrder({
        activeTenantId: null,
        propertyTenantId: 'tenant-a',
        serviceTenantId: 'tenant-a',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('hides a property from another tenant', () => {
    expect(
      canUseTenantServiceOrder({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
        serviceTenantId: 'tenant-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides a service order from another tenant even when the property id is known', () => {
    expect(
      canUseTenantServiceOrder({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        serviceTenantId: 'tenant-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('does not expose legacy service orders without tenant_id', () => {
    expect(
      canUseTenantServiceOrder({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        serviceTenantId: null,
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows service access when property and service belong to the active tenant', () => {
    expect(
      canUseTenantServiceOrder({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        serviceTenantId: 'tenant-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks assignment to a provider outside the active tenant/property', () => {
    expect(
      canAssignProviderToTenantService({
        activeTenantId: 'tenant-a',
        propertyId: 'property-a',
        providerCollaboratorTenantId: 'tenant-a',
        providerCollaboratorPropertyId: 'property-b',
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('allows assignment to a provider collaborator in the active tenant/property', () => {
    expect(
      canAssignProviderToTenantService({
        activeTenantId: 'tenant-a',
        propertyId: 'property-a',
        providerCollaboratorTenantId: 'tenant-a',
        providerCollaboratorPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks a public service link when link, service and property tenants diverge', () => {
    expect(
      canUsePublicServiceLink({
        linkTenantId: 'tenant-a',
        serviceTenantId: 'tenant-b',
        propertyTenantId: 'tenant-a',
        linkStatus: 'active',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('blocks an expired public service link', () => {
    expect(
      canUsePublicServiceLink({
        linkTenantId: 'tenant-a',
        serviceTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        linkStatus: 'active',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })
    ).toEqual({ allowed: false, status: 409, code: 'LINK_EXPIRED' });
  });

  it('allows an active scoped public service link', () => {
    expect(
      canUsePublicServiceLink({
        linkTenantId: 'tenant-a',
        serviceTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        linkStatus: 'active',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    ).toEqual({ allowed: true });
  });

  it('blocks a provider from the chat/service cycle when not assigned and without an active bid', () => {
    expect(
      canProviderAccessTenantServiceCycle({
        activeTenantId: 'tenant-a',
        serviceTenantId: 'tenant-a',
        userId: 'provider-a',
        assignedProviderId: 'provider-b',
        hasActiveProviderBid: false,
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('blocks a provider from bidding or chat in another tenant service', () => {
    expect(
      canProviderAccessTenantServiceCycle({
        activeTenantId: 'tenant-a',
        serviceTenantId: 'tenant-b',
        userId: 'provider-a',
        assignedProviderId: 'provider-a',
        hasActiveProviderBid: true,
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows a provider assigned to the active tenant service cycle', () => {
    expect(
      canProviderAccessTenantServiceCycle({
        activeTenantId: 'tenant-a',
        serviceTenantId: 'tenant-a',
        userId: 'provider-a',
        assignedProviderId: 'provider-a',
      })
    ).toEqual({ allowed: true });
  });
});
