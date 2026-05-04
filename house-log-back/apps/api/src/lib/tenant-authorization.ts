import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { properties, propertyCollaborators } from '../db/schema';
import type { Role, TenantRole } from './types';

export type TenantPropertyAccessLevel = 'view' | 'manage' | 'open_service_order' | 'secret' | 'assigned_service';

export type TenantPropertyAccessDecision =
  | { allowed: true; reason: string }
  | { allowed: false; status: 400 | 403 | 404; code: 'TENANT_REQUIRED' | 'FORBIDDEN' | 'NOT_FOUND' };

export type TenantPropertyAccessInput = {
  activeTenantId?: string | null;
  tenantRole?: TenantRole | null;
  userId: string;
  userRole: Role;
  propertyTenantId?: string | null;
  propertyOwnerId?: string | null;
  propertyManagerId?: string | null;
  accessLevel?: TenantPropertyAccessLevel;
  collaborator?: {
    tenantId?: string | null;
    role: 'viewer' | 'provider' | 'manager';
    canOpenOs?: number | boolean | null;
  } | null;
  assignedProviderId?: string | null;
};

function isProviderRole(role: Role): boolean {
  return role === 'provider' || role === 'temp_provider';
}

function canOpenOs(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1;
}

export function canUseTenantPropertyAccess(input: TenantPropertyAccessInput): TenantPropertyAccessDecision {
  const accessLevel = input.accessLevel ?? 'view';

  if (!input.activeTenantId || !input.tenantRole) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }

  if (!input.propertyTenantId || input.propertyTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }

  if (accessLevel === 'assigned_service') {
    if (isProviderRole(input.userRole) && input.assignedProviderId === input.userId) {
      return { allowed: true, reason: 'provider_assigned_service' };
    }
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  if (isProviderRole(input.userRole)) {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  if (accessLevel === 'secret') {
    if (input.tenantRole === 'owner') return { allowed: true, reason: 'tenant_owner_secret' };
    if (input.propertyOwnerId === input.userId || input.propertyManagerId === input.userId) {
      return { allowed: true, reason: 'direct_property_secret' };
    }
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  if (input.tenantRole === 'owner') {
    return { allowed: true, reason: 'tenant_owner' };
  }

  if (input.tenantRole === 'manager') {
    return { allowed: true, reason: 'tenant_manager' };
  }

  if (input.propertyOwnerId === input.userId) {
    return { allowed: true, reason: 'property_owner' };
  }

  if (input.propertyManagerId === input.userId) {
    return { allowed: true, reason: 'property_manager' };
  }

  const collaborator = input.collaborator;
  if (!collaborator || collaborator.tenantId !== input.activeTenantId) {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  if (accessLevel === 'view') {
    return { allowed: true, reason: 'property_collaborator_view' };
  }

  if (accessLevel === 'manage' && collaborator.role === 'manager') {
    return { allowed: true, reason: 'property_collaborator_manager' };
  }

  if (
    accessLevel === 'open_service_order' &&
    collaborator.role !== 'viewer' &&
    canOpenOs(collaborator.canOpenOs)
  ) {
    return { allowed: true, reason: 'property_collaborator_open_service_order' };
  }

  return { allowed: false, status: 403, code: 'FORBIDDEN' };
}

export async function canAccessTenantProperty(
  db: D1Database,
  input: {
    tenantId?: string | null;
    tenantRole?: TenantRole | null;
    propertyId: string;
    userId: string;
    userRole: Role;
    accessLevel?: TenantPropertyAccessLevel;
    assignedProviderId?: string | null;
  }
): Promise<TenantPropertyAccessDecision> {
  if (!input.tenantId || !input.tenantRole) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }

  const drizzle = getDb(db);
  const [property] = await drizzle
    .select({
      tenantId: properties.tenantId,
      ownerId: properties.ownerId,
      managerId: properties.managerId,
    })
    .from(properties)
    .where(and(eq(properties.id, input.propertyId), eq(properties.tenantId, input.tenantId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return { allowed: false, status: 404, code: 'NOT_FOUND' };

  let collaborator: TenantPropertyAccessInput['collaborator'] = null;
  try {
    const [row] = await drizzle
      .select({
        tenantId: propertyCollaborators.tenantId,
        role: propertyCollaborators.role,
        canOpenOs: propertyCollaborators.canOpenOs,
      })
      .from(propertyCollaborators)
      .where(
        and(
          eq(propertyCollaborators.tenantId, input.tenantId),
          eq(propertyCollaborators.propertyId, input.propertyId),
          eq(propertyCollaborators.userId, input.userId)
        )
      )
      .limit(1);
    collaborator = row ?? null;
  } catch (e) {
    if (!String(e).includes('property_collaborators')) throw e;
  }

  return canUseTenantPropertyAccess({
    activeTenantId: input.tenantId,
    tenantRole: input.tenantRole,
    userId: input.userId,
    userRole: input.userRole,
    propertyTenantId: property.tenantId,
    propertyOwnerId: property.ownerId,
    propertyManagerId: property.managerId,
    accessLevel: input.accessLevel,
    collaborator,
    assignedProviderId: input.assignedProviderId,
  });
}

export async function listAccessibleTenantPropertyIds(
  db: D1Database,
  subject: { tenantId?: string | null; tenantRole?: TenantRole | null; userId: string; userRole: Role }
): Promise<string[]> {
  if (!subject.tenantId || !subject.tenantRole || isProviderRole(subject.userRole)) return [];

  const drizzle = getDb(db);

  if (subject.tenantRole === 'owner' || subject.tenantRole === 'manager') {
    const rows = await drizzle
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.tenantId, subject.tenantId), isNull(properties.deletedAt)));
    return rows.map((row) => row.id);
  }

  const owned = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.tenantId, subject.tenantId),
        or(eq(properties.ownerId, subject.userId), eq(properties.managerId, subject.userId)),
        isNull(properties.deletedAt)
      )
    );

  let collaboratorRows: Array<{ id: string }> = [];
  try {
    collaboratorRows = await drizzle
      .select({ id: propertyCollaborators.propertyId })
      .from(propertyCollaborators)
      .innerJoin(properties, eq(properties.id, propertyCollaborators.propertyId))
      .where(
        and(
          eq(propertyCollaborators.tenantId, subject.tenantId),
          eq(propertyCollaborators.userId, subject.userId),
          eq(properties.tenantId, subject.tenantId),
          isNull(properties.deletedAt)
        )
      );
  } catch (e) {
    if (!String(e).includes('property_collaborators')) throw e;
  }

  return Array.from(new Set([...owned, ...collaboratorRows].map((row) => row.id)));
}
