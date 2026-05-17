import { Hono } from 'hono';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { PublicHandoverPackageAcceptInputSchema } from '@houselog/contracts';
import { ok, err } from '../lib/response';
import { getDb } from '../db/client';
import { handoverPackages, tenants, users } from '../db/schema';
import { writeAuditLog } from '../lib/audit';
import type { Bindings, Variables } from '../lib/types';
import { hashPublicHandoverToken, resolvePublicHandoverPackage } from '../lib/handover-public';
import { applyPublicLinkRateLimit } from '../lib/public-link-rate-limit';

const publicHandover = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function publicLinkUnavailable(c: Parameters<typeof err>[0]) {
  return err(c, 'Link indisponivel', 'PUBLIC_LINK_UNAVAILABLE', 404);
}

function publicLinkRateLimited(c: Parameters<typeof err>[0]) {
  return err(c, 'Muitas tentativas. Tente novamente em alguns instantes.', 'RATE_LIMITED', 429);
}

/** Truncate user-agent to a safe max length before persisting. */
function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return ua.length > 500 ? ua.slice(0, 500) : ua;
}

publicHandover.get('/handover/:token', async (c) => {
  const db = getDb(c.env.DB);
  const token = c.req.param('token')!;
  const tokenHash = await hashPublicHandoverToken(token);
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const allowed = await applyPublicLinkRateLimit({
    kv: c.env.KV,
    flow: 'handover',
    action: 'read',
    ip,
    tokenHash,
  });
  if (!allowed) return publicLinkRateLimited(c);

  const [row] = await db
    .select({
      id: handoverPackages.id,
      tenant_id: handoverPackages.tenantId,
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
      accepted_by_name: handoverPackages.acceptedByName,
      accepted_by_email: handoverPackages.acceptedByEmail,
      acceptance_notes: handoverPackages.acceptanceNotes,
      accepted_signature_data_url: handoverPackages.acceptedSignatureDataUrl,
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
      return publicLinkUnavailable(c);
    }
    await writeAuditLog(c.env.DB, {
      tenantId: row!.tenant_id,
      propertyId: row!.property_id,
      entityType: 'handover_package',
      entityId: row!.id,
      action: 'handover_package_public_viewed',
      actorId: null,
      actorIp: c.req.header('CF-Connecting-IP') ?? undefined,
      newData: {
        actor_type: 'public',
        source: 'public_handover_link',
      },
    });
    return ok(c, { package: resolved.package });
  } catch {
    return err(c, 'Erro interno', 'INTERNAL_ERROR', 500);
  }
});

publicHandover.post('/handover/:token/accept', async (c) => {
  const db = getDb(c.env.DB);
  const token = c.req.param('token')!;
  const tokenHash = await hashPublicHandoverToken(token);
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const allowed = await applyPublicLinkRateLimit({
    kv: c.env.KV,
    flow: 'handover',
    action: 'mutate',
    ip,
    tokenHash,
  });
  if (!allowed) return publicLinkRateLimited(c);
  const body = await c.req.json().catch((): unknown => ({}));
  const parsedBody = PublicHandoverPackageAcceptInputSchema.safeParse(body);

  if (!parsedBody.success) {
    return err(c, 'Dados do aceite invalidos', 'VALIDATION_ERROR', 422);
  }

  // Capture evidence from request headers — never accept from client body.
  const acceptedIp = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null;
  const acceptedUserAgent = truncateUserAgent(c.req.header('User-Agent'));

  const [row] = await db
    .select({
      id: handoverPackages.id,
      tenant_id: handoverPackages.tenantId,
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
      accepted_by_name: handoverPackages.acceptedByName,
      accepted_by_email: handoverPackages.acceptedByEmail,
      acceptance_notes: handoverPackages.acceptanceNotes,
      accepted_signature_data_url: handoverPackages.acceptedSignatureDataUrl,
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

  if (!row) return publicLinkUnavailable(c);

  if (row.revoked_at || row.status === 'revoked') {
    return publicLinkUnavailable(c);
  }

  if (row.status === 'expired') {
    return publicLinkUnavailable(c);
  }

  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : Number.NaN;
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    return publicLinkUnavailable(c);
  }

  if (row.status === 'accepted' || row.accepted_at) {
    return err(c, 'Entrega digital ja aceita', 'PACKAGE_ALREADY_ACCEPTED', 409);
  }

  if (row.status !== 'issued') {
    return publicLinkUnavailable(c);
  }

  const now = new Date().toISOString();
  const signatureDataUrl = parsedBody.data.signatureDataUrl ?? null;

  await db
    .update(handoverPackages)
    .set({
      status: 'accepted',
      acceptedAt: now,
      acceptedByName: parsedBody.data.acceptedByName,
      acceptedByEmail: parsedBody.data.acceptedByEmail,
      acceptanceNotes: parsedBody.data.acceptanceNotes ?? null,
      acceptedIp,
      acceptedUserAgent,
      acceptedSignatureDataUrl: signatureDataUrl,
      updatedAt: now,
    })
    .where(and(eq(handoverPackages.id, row.id), eq(handoverPackages.publicAccessTokenHash, tokenHash), isNull(handoverPackages.deletedAt)));

  const acceptedRow = {
    ...row,
    status: 'accepted' as const,
    accepted_at: now,
    accepted_by_name: parsedBody.data.acceptedByName,
    accepted_by_email: parsedBody.data.acceptedByEmail,
    acceptance_notes: parsedBody.data.acceptanceNotes ?? null,
    accepted_signature_data_url: signatureDataUrl,
    updated_at: now,
  };

  await writeAuditLog(c.env.DB, {
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    entityType: 'handover_package',
    entityId: row.id,
    action: 'handover_package_public_accepted',
    actorId: null,
    actorIp: acceptedIp ?? undefined,
    oldData: {
      id: row.id,
      property_id: row.property_id,
      status: row.status,
      accepted_at: row.accepted_at,
    },
    newData: {
      id: row.id,
      property_id: row.property_id,
      status: 'accepted',
      accepted_at: now,
      actor_type: 'public',
      acceptedByName: parsedBody.data.acceptedByName,
      acceptedByEmail: parsedBody.data.acceptedByEmail,
      acceptanceNotes: parsedBody.data.acceptanceNotes ?? null,
      acceptedUserAgent,
      hasSignature: !!signatureDataUrl,
      source: 'public_handover_accept',
    },
  });

  const resolved = resolvePublicHandoverPackage(acceptedRow);
  if (!resolved.ok) {
    if (resolved.status === 500) return err(c, 'Erro interno', 'INTERNAL_ERROR', 500);
    return publicLinkUnavailable(c);
  }

  return ok(c, { package: resolved.package });
});

export default publicHandover;
