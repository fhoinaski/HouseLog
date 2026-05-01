import { createMiddleware } from 'hono/factory';
import { and, eq, isNull, or } from 'drizzle-orm';
import { verifyJwt } from '../lib/jwt';
import { getDb } from '../db/client';
import { properties, propertyCollaborators, tenantMembers, tenants } from '../db/schema';
import {
  canAccessProperty,
  canRevealCredentialSecret,
} from '../lib/authorization';
import type { Bindings, Variables, Role, TenantRole } from '../lib/types';

// Extracts JWT from Authorization header and sets userId/userRole in context
export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401);
  }

  const token = authHeader.slice(7);
  const secret = c.env.JWT_SECRET;

  if (!secret) {
    return c.json({ error: 'Configuração de segurança inválida', code: 'SERVER_ERROR' }, 500);
  }

  try {
    const payload = await verifyJwt(token, secret);
    c.set('userId', payload.sub);
    c.set('userRole', payload.role);
    c.set('userEmail', payload.email);
    await next();
  } catch {
    return c.json({ error: 'Token inválido ou expirado', code: 'UNAUTHORIZED' }, 401);
  }
});

export const requireAuth = authMiddleware;

// Role guard factory — use after authMiddleware
export function requireRole(...roles: Role[]) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const role = c.get('userRole');
    if (!roles.includes(role)) {
      return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN' }, 403);
    }
    await next();
  });
}

// Verifies the requesting user owns/manages the property.
// Admins no longer have blanket access — they must be explicitly assigned
// as owner, manager_id, or collaborator (same as any other user).
export async function assertPropertyAccess(
  db: D1Database,
  propertyId: string,
  userId: string,
  role: Role
): Promise<boolean> {
  return canAccessProperty(db, { propertyId, userId, role });
}

export const resolveTenant = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const requestedTenantId = c.req.header('X-Tenant-Id') ?? c.req.query('tenant_id');

  const filters = [
    eq(tenantMembers.userId, userId),
    eq(tenantMembers.status, 'active'),
    eq(tenants.status, 'active'),
  ];

  if (requestedTenantId) {
    filters.push(eq(tenantMembers.tenantId, requestedTenantId));
  }

  const [membership] = await db
    .select({
      tenantId: tenantMembers.tenantId,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(and(...filters))
    .limit(1);

  if (!membership) {
    return c.json({ error: 'Tenant ativo não encontrado', code: 'TENANT_REQUIRED' }, 403);
  }

  c.set('tenantId', membership.tenantId);
  c.set('tenantRole', membership.role);
  await next();
});

export function requireTenantRole(...roles: TenantRole[]) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const tenantRole = c.get('tenantRole');
    if (!tenantRole || !roles.includes(tenantRole)) {
      return c.json({ error: 'Permissão insuficiente no tenant', code: 'FORBIDDEN' }, 403);
    }
    await next();
  });
}

export async function assertTenantAccess(
  db: D1Database,
  tenantId: string,
  userId: string,
  allowedRoles?: TenantRole[]
): Promise<boolean> {
  const drizzle = getDb(db);
  const [membership] = await drizzle
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.status, 'active'),
        eq(tenants.status, 'active')
      )
    )
    .limit(1);

  if (!membership) return false;
  return allowedRoles ? allowedRoles.includes(membership.role) : true;
}

// Sensitive property secrets require a direct owner/manager relationship.
// Collaborator access is intentionally excluded until credential-specific
// permissions exist.
export async function assertPropertySecretAccess(
  db: D1Database,
  propertyId: string,
  userId: string,
  role: Role
): Promise<boolean> {
  return canRevealCredentialSecret(db, { propertyId, userId, role });
}

// Returns whether a user is allowed to open (create) a service order on a property.
// - Owner or manager_id: always allowed
// - Collaborator with role='manager' or 'provider': allowed only if can_open_os = 1
// - Collaborator with role='viewer': never allowed
export async function canUserOpenOS(
  db: D1Database,
  propertyId: string,
  userId: string
): Promise<boolean> {
  const drizzle = getDb(db);
  const [owned] = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        or(eq(properties.ownerId, userId), eq(properties.managerId, userId)),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);
  if (owned) return true;

  try {
    const [collab] = await drizzle
      .select({
        role: propertyCollaborators.role,
        canOpenOs: propertyCollaborators.canOpenOs,
      })
      .from(propertyCollaborators)
      .where(
        and(
          eq(propertyCollaborators.propertyId, propertyId),
          eq(propertyCollaborators.userId, userId)
        )
      )
      .limit(1);

    if (!collab) return false;
    if (collab.role === 'viewer') return false;
    return collab.canOpenOs === 1;
  } catch (e) {
    if (String(e).includes('property_collaborators')) return false;
    throw e;
  }
}
