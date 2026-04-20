import { createMiddleware } from 'hono/factory';
import { and, eq, isNull, or } from 'drizzle-orm';
import { verifyJwt } from '../lib/jwt';
import { getDb } from '../db/client';
import { properties, propertyCollaborators } from '../db/schema';
import type { Bindings, Variables, Role } from '../lib/types';

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
  // Providers must use provider portal/public share flows only.
  // They cannot access property-level owner/manager dashboards.
  if (role === 'provider' || role === 'temp_provider') return false;

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
      .select({ id: propertyCollaborators.id })
      .from(propertyCollaborators)
      .where(
        and(
          eq(propertyCollaborators.propertyId, propertyId),
          eq(propertyCollaborators.userId, userId)
        )
      )
      .limit(1);
    return !!collab;
  } catch (e) {
    if (String(e).includes('property_collaborators')) return false;
    throw e;
  }
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
  if (role === 'provider' || role === 'temp_provider') return false;

  const drizzle = getDb(db);
  const [property] = await drizzle
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

  return !!property;
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
