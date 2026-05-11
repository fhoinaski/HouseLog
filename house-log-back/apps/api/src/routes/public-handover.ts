import { Hono } from 'hono';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { getDb } from '../db/client';
import { handoverPackages, tenants, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';
import { hashPublicHandoverToken, resolvePublicHandoverPackage } from '../lib/handover-public';

const publicHandover = new Hono<{ Bindings: Bindings; Variables: Variables }>();

publicHandover.get('/handover/:token', async (c) => {
  const db = getDb(c.env.DB);
  const token = c.req.param('token')!;
  const tokenHash = await hashPublicHandoverToken(token);

  const [row] = await db
    .select({
      id: handoverPackages.id,
      property_id: handoverPackages.propertyId,
      title: handoverPackages.title,
      description: handoverPackages.description,
      issuer_name: users.name,
      issuer_role: sql<string | null>`case when ${users.id} is not null then 'Responsavel pela entrega' else null end`,
      responsible_name: users.name,
      company_name: tenants.name,
      type: handoverPackages.type,
      status: handoverPackages.status,
      version: handoverPackages.version,
      issued_at: handoverPackages.issuedAt,
      accepted_at: handoverPackages.acceptedAt,
      revoked_at: handoverPackages.revokedAt,
      expires_at: handoverPackages.expiresAt,
      created_at: handoverPackages.createdAt,
      updated_at: handoverPackages.updatedAt,
      snapshot_json: handoverPackages.snapshotJson,
    })
    .from(handoverPackages)
    .leftJoin(users, eq(users.id, handoverPackages.issuedBy))
    .leftJoin(tenants, eq(tenants.id, handoverPackages.tenantId))
    .where(and(eq(handoverPackages.publicAccessTokenHash, tokenHash), isNull(handoverPackages.deletedAt)))
    .limit(1);

  try {
    const resolved = resolvePublicHandoverPackage(row ?? null);
    if (!resolved.ok) {
      if (resolved.status === 500) return err(c, 'Erro interno', 'INTERNAL_ERROR', 500);
      if (resolved.code === 'LINK_EXPIRED') {
        return err(c, 'Link expirado', 'LINK_EXPIRED', 410);
      }
      if (resolved.code === 'PACKAGE_REVOKED') {
        return err(c, 'Pacote revogado', 'PACKAGE_REVOKED', 410);
      }
      return err(c, 'Pacote nao encontrado', 'NOT_FOUND', 404);
    }
    return ok(c, { package: resolved.package });
  } catch {
    return err(c, 'Erro interno', 'INTERNAL_ERROR', 500);
  }
});

export default publicHandover;
