export type MaintenanceTenantDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' };

export function canUseTenantMaintenanceSchedule(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
  scheduleTenantId?: string | null;
  schedulePropertyId?: string | null;
  requestedPropertyId: string;
}): MaintenanceTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };

  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  if (
    !input.scheduleTenantId ||
    input.scheduleTenantId !== input.activeTenantId ||
    input.schedulePropertyId !== input.requestedPropertyId
  ) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  return { allowed: true };
}

export function canCreateMaintenanceScheduleInTenant(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
}): MaintenanceTenantDecision {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}

export function canUseTenantMaintenanceMetrics(input: {
  activeTenantId?: string | null;
  propertyTenantId?: string | null;
}): MaintenanceTenantDecision {
  return canCreateMaintenanceScheduleInTenant(input);
}
