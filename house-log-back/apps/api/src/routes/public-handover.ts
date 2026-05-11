import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { getDb } from '../db/client';
import { handoverPackages } from '../db/schema';
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
    .where(and(eq(handoverPackages.publicAccessTokenHash, tokenHash), isNull(handoverPackages.deletedAt)))
    .limit(1);

  try {
    const resolved = resolvePublicHandoverPackage(row ?? null);
    if (!resolved.ok) {
      return resolved.status === 500
        ? err(c, 'Erro interno', 'INTERNAL_ERROR', 500)
        : err(c, 'Pacote nao encontrado', 'NOT_FOUND', 404);
    }
    return ok(c, { package: resolved.package });
  } catch {
    return err(c, 'Erro interno', 'INTERNAL_ERROR', 500);
  }
});

export default publicHandover;
