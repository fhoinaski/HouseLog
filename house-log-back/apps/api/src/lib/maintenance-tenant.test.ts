import { describe, expect, it } from 'vitest';
import {
  canCreateMaintenanceScheduleInTenant,
  canUseTenantMaintenanceMetrics,
  canUseTenantMaintenanceSchedule,
} from './maintenance-tenant';

describe('maintenance tenant isolation', () => {
  it('blocks schedule creation without an active tenant', () => {
    expect(
      canCreateMaintenanceScheduleInTenant({
        activeTenantId: null,
        propertyTenantId: 'tenant-a',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('blocks schedule creation in another tenant property', () => {
    expect(
      canCreateMaintenanceScheduleInTenant({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows schedule creation in the active tenant property', () => {
    expect(
      canCreateMaintenanceScheduleInTenant({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
      })
    ).toEqual({ allowed: true });
  });

  it('hides a schedule from another tenant', () => {
    expect(
      canUseTenantMaintenanceSchedule({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        scheduleTenantId: 'tenant-b',
        schedulePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('does not expose legacy schedules without tenant_id', () => {
    expect(
      canUseTenantMaintenanceSchedule({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        scheduleTenantId: null,
        schedulePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('hides a schedule attached to another property', () => {
    expect(
      canUseTenantMaintenanceSchedule({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        scheduleTenantId: 'tenant-a',
        schedulePropertyId: 'property-b',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows schedule access when tenant and property match', () => {
    expect(
      canUseTenantMaintenanceSchedule({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-a',
        scheduleTenantId: 'tenant-a',
        schedulePropertyId: 'property-a',
        requestedPropertyId: 'property-a',
      })
    ).toEqual({ allowed: true });
  });

  it('blocks maintenance metrics for another tenant', () => {
    expect(
      canUseTenantMaintenanceMetrics({
        activeTenantId: 'tenant-a',
        propertyTenantId: 'tenant-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});
