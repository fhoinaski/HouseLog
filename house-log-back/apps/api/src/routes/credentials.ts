import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

const credentials = new Hono<{ Bindings: Bindings; Variables: Variables }>();
credentials.use('*', authMiddleware);

const CATEGORIES = ['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other'] as const;

const createSchema = z.object({
  category:          z.enum(CATEGORIES).default('other'),
  label:             z.string().min(1),
  username:          z.string().optional(),
  secret:            z.string().min(1),
  notes:             z.string().optional(),
  integration_type:  z.enum(['intelbras']).optional().nullable(),
  integration_config: z.record(z.unknown()).optional().nullable(),
  share_with_os:     z.boolean().default(false),
});

type Credential = {
  id: string;
  property_id: string;
  created_by: string;
  category: string;
  label: string;
  username: string | null;
  secret: string;
  notes: string | null;
  integration_type: string | null;
  integration_config: string | null;
  share_with_os: number;
  created_at: string;
  updated_at: string;
};

// ── GET /properties/:propertyId/credentials ──────────────────────────────────

credentials.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { results } = await c.env.DB
    .prepare(
      `SELECT id, property_id, category, label, username, secret, notes,
              integration_type, integration_config, share_with_os, created_at, updated_at
       FROM property_access_credentials
       WHERE property_id = ? AND deleted_at IS NULL
       ORDER BY category, label`
    )
    .bind(propertyId)
    .all<Credential>();

  const items = results.map((r) => ({
    ...r,
    integration_config: r.integration_config ? JSON.parse(r.integration_config) : null,
    share_with_os: r.share_with_os === 1,
  }));

  return ok(c, { credentials: items });
});

// ── POST /properties/:propertyId/credentials ─────────────────────────────────

credentials.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;
  const id = nanoid();

  await c.env.DB
    .prepare(
      `INSERT INTO property_access_credentials
         (id, property_id, created_by, category, label, username, secret, notes,
          integration_type, integration_config, share_with_os)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, propertyId, userId, category, label,
      username ?? null, secret,
      notes ?? null,
      integration_type ?? null,
      integration_config ? JSON.stringify(integration_config) : null,
      share_with_os ? 1 : 0
    )
    .run();

  const row = await c.env.DB
    .prepare(`SELECT * FROM property_access_credentials WHERE id = ?`)
    .bind(id)
    .first<Credential>();

  return ok(c, {
    credential: {
      ...row,
      integration_config: row?.integration_config ? JSON.parse(row.integration_config) : null,
      share_with_os: row?.share_with_os === 1,
    }
  }, 201);
});

// ── PUT /properties/:propertyId/credentials/:credId ──────────────────────────

credentials.put('/:credId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const credId = c.req.param('credId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const existing = await c.env.DB
    .prepare(`SELECT id FROM property_access_credentials WHERE id = ? AND property_id = ? AND deleted_at IS NULL`)
    .bind(credId, propertyId)
    .first();
  if (!existing) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;

  const fields: string[] = ['updated_at = datetime(\'now\')'];
  const vals: unknown[] = [];

  if (category          !== undefined) { fields.push('category = ?');           vals.push(category); }
  if (label             !== undefined) { fields.push('label = ?');              vals.push(label); }
  if (username          !== undefined) { fields.push('username = ?');           vals.push(username ?? null); }
  if (secret            !== undefined) { fields.push('secret = ?');             vals.push(secret); }
  if (notes             !== undefined) { fields.push('notes = ?');              vals.push(notes ?? null); }
  if (integration_type  !== undefined) { fields.push('integration_type = ?');   vals.push(integration_type ?? null); }
  if (integration_config !== undefined) { fields.push('integration_config = ?'); vals.push(integration_config ? JSON.stringify(integration_config) : null); }
  if (share_with_os     !== undefined) { fields.push('share_with_os = ?');      vals.push(share_with_os ? 1 : 0); }

  vals.push(credId);

  await c.env.DB
    .prepare(`UPDATE property_access_credentials SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run();

  const row = await c.env.DB
    .prepare(`SELECT * FROM property_access_credentials WHERE id = ?`)
    .bind(credId)
    .first<Credential>();

  return ok(c, {
    credential: {
      ...row,
      integration_config: row?.integration_config ? JSON.parse(row.integration_config) : null,
      share_with_os: row?.share_with_os === 1,
    }
  });
});

// ── DELETE /properties/:propertyId/credentials/:credId ───────────────────────

credentials.delete('/:credId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const credId = c.req.param('credId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  await c.env.DB
    .prepare(
      `UPDATE property_access_credentials
       SET deleted_at = datetime('now')
       WHERE id = ? AND property_id = ? AND deleted_at IS NULL`
    )
    .bind(credId, propertyId)
    .run();

  return ok(c, { deleted: true });
});

// ── POST /properties/:propertyId/credentials/:credId/generate-temp-code ──────
// Intelbras smart lock: generate a temporary PIN (stub — real call done client-side
// or via a dedicated worker; here we demonstrate the flow).

credentials.post('/:credId/generate-temp-code', async (c) => {
  const propertyId = c.req.param('propertyId');
  const credId = c.req.param('credId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => ({})) as { expires_hours?: number; provider_name?: string };
  const expiresHours = body.expires_hours ?? 24;

  const cred = await c.env.DB
    .prepare(`SELECT * FROM property_access_credentials WHERE id = ? AND property_id = ? AND deleted_at IS NULL`)
    .bind(credId, propertyId)
    .first<Credential>();

  if (!cred) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);
  if (cred.integration_type !== 'intelbras') {
    return err(c, 'Esta credencial não tem integração Intelbras configurada', 'INVALID_INTEGRATION', 400);
  }

  // Generate a 6-digit temporary PIN (real implementation would call Intelbras API)
  const tempPin = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  // In production: POST to Intelbras controller API to create a temporary user/card
  // const config = JSON.parse(cred.integration_config ?? '{}');
  // await callIntelbrasApi(config, tempPin, expiresAt);

  return ok(c, {
    temp_pin: tempPin,
    expires_at: expiresAt,
    expires_hours: expiresHours,
    note: 'PIN temporário gerado. Configure no painel Intelbras se necessário.',
  });
});

export default credentials;
