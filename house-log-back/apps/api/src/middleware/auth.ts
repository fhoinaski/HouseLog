import { createMiddleware } from 'hono/factory';
import { and, eq } from 'drizzle-orm';
import { verifyJwt, resolveJwtSecret } from '../lib/jwt';
import { getDb } from '../db/client';
import { tenantMembers, tenants } from '../db/schema';
import {
  canAccessProperty,
  canRevealCredentialSecret,
} from '../lib/authorization';
import { canAccessTenantProperty, type TenantPropertyAccessLevel } from '../lib/tenant-authorization';
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
  const secret = resolveJwtSecret({ JWT_SECRET: c.env.JWT_SECRET, ENVIRONMENT: c.env.ENVIRONMENT });

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
  role: Role,
  tenantId?: string | null,
  tenantRole?: TenantRole | null,
  accessLevel: TenantPropertyAccessLevel = 'view'
): Promise<boolean> {
  if (tenantId && tenantRole) {
    const decision = await canAccessTenantProperty(db, {
      tenantId,
      tenantRole,
      propertyId,
      userId,
      userRole: role,
      accessLevel,
    });
    return decision.allowed;
  }
  return canAccessProperty(db, { propertyId, userId, role });
}

export async function assertTenantPropertyAccess(
  db: D1Database,
  input: {
    tenantId?: string | null;
    tenantRole?: TenantRole | null;
    propertyId: string;
    userId: string;
    userRole: Role;
    accessLevel?: TenantPropertyAccessLevel;
  }
): Promise<boolean> {
  const decision = await canAccessTenantProperty(db, input);
  return decision.allowed;
}

export function requireTenantPropertyAccess(
  propertyParam: string = 'propertyId',
  accessLevel: TenantPropertyAccessLevel = 'view'
) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const propertyId = c.req.param(propertyParam);
    if (!propertyId) {
      return c.json({ error: 'Imovel nao informado', code: 'INVALID_PROPERTY' }, 400);
    }

    const decision = await canAccessTenantProperty(c.env.DB, {
      tenantId: c.get('tenantId'),
      tenantRole: c.get('tenantRole'),
      propertyId,
      userId: c.get('userId'),
      userRole: c.get('userRole'),
      accessLevel,
    });

    if (!decision.allowed) {
      const message = decision.code === 'NOT_FOUND'
        ? 'Imovel nao encontrado'
        : decision.code === 'TENANT_REQUIRED'
          ? 'Tenant ativo obrigatorio'
          : 'Sem acesso a este imovel';
      return c.json({ error: message, code: decision.code }, decision.status);
    }

    await next();
  });
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
    return c.json({ error: 'Tenant ativo não encontrado', code: 'TENANT_REQUIRED' }, 400);
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
  role: Role,
  tenantId?: string | null,
  tenantRole?: TenantRole | null
): Promise<boolean> {
  if (tenantId && tenantRole) {
    const decision = await canAccessTenantProperty(db, {
      tenantId,
      tenantRole,
      propertyId,
      userId,
      userRole: role,
      accessLevel: 'secret',
    });
    return decision.allowed;
  }
  return canRevealCredentialSecret(db, { propertyId, userId, role });
}
