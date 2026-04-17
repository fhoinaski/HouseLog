import { createMiddleware } from 'hono/factory';
import { verifyJwt } from '../lib/jwt';
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
  _role: Role
): Promise<boolean> {
  const owned = await db
    .prepare(
      `SELECT id FROM properties
       WHERE id = ? AND (owner_id = ? OR manager_id = ?) AND deleted_at IS NULL`
    )
    .bind(propertyId, userId, userId)
    .first();
  if (owned) return true;

  const collab = await db
    .prepare(`SELECT id FROM property_collaborators WHERE property_id = ? AND user_id = ?`)
    .bind(propertyId, userId)
    .first();
  return collab !== null;
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
  const owned = await db
    .prepare(
      `SELECT id FROM properties
       WHERE id = ? AND (owner_id = ? OR manager_id = ?) AND deleted_at IS NULL`
    )
    .bind(propertyId, userId, userId)
    .first();
  if (owned) return true;

  const collab = await db
    .prepare(
      `SELECT role, can_open_os FROM property_collaborators
       WHERE property_id = ? AND user_id = ?`
    )
    .bind(propertyId, userId)
    .first<{ role: string; can_open_os: number }>();

  if (!collab) return false;
  if (collab.role === 'viewer') return false;
  return collab.can_open_os === 1;
}
