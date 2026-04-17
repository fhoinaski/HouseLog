import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, requireRole, assertPropertyAccess } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl } from '../lib/r2';
import type { Bindings, Variables, Property } from '../lib/types';

const properties = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All routes require auth
properties.use('*', authMiddleware);

// ── Schemas ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
  address: z.string().min(1),
  city: z.string().min(1),
  area_m2: z.number().positive().optional(),
  year_built: z.number().int().min(1800).max(2100).optional(),
  structure: z.string().optional(),
  floors: z.number().int().min(1).default(1),
  owner_id: z.string().optional(), // admin can set this
});

const updateSchema = createSchema.partial().extend({
  cover_url: z.string().url().optional().nullable(),
});

// ── GET /properties ─────────────────────────────────────────────────────────

properties.get('/', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const search = c.req.query('search');

  let query: string;
  let bindings: unknown[];

  if (role === 'admin') {
    query = `
      SELECT p.*, u.name as owner_name, u.email as owner_email
      FROM properties p
      JOIN users u ON u.id = p.owner_id
      WHERE p.deleted_at IS NULL
      ${search ? "AND (p.name LIKE ? OR p.city LIKE ?)" : ''}
      ${cursor ? "AND p.created_at < ?" : ''}
      ORDER BY p.created_at DESC LIMIT ?
    `;
    bindings = search
      ? cursor
        ? [`%${search}%`, `%${search}%`, cursor, limit + 1]
        : [`%${search}%`, `%${search}%`, limit + 1]
      : cursor
        ? [cursor, limit + 1]
        : [limit + 1];
  } else {
    query = `
      SELECT p.*, u.name as owner_name, u.email as owner_email
      FROM properties p
      JOIN users u ON u.id = p.owner_id
      WHERE p.deleted_at IS NULL AND (p.owner_id = ? OR p.manager_id = ?)
      ${search ? "AND (p.name LIKE ? OR p.city LIKE ?)" : ''}
      ${cursor ? "AND p.created_at < ?" : ''}
      ORDER BY p.created_at DESC LIMIT ?
    `;
    bindings = search
      ? cursor
        ? [userId, userId, `%${search}%`, `%${search}%`, cursor, limit + 1]
        : [userId, userId, `%${search}%`, `%${search}%`, limit + 1]
      : cursor
        ? [userId, userId, cursor, limit + 1]
        : [userId, userId, limit + 1];
  }

  const { results } = await c.env.DB
    .prepare(query)
    .bind(...bindings)
    .all<Property & { owner_name: string; owner_email: string }>();

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties ────────────────────────────────────────────────────────

properties.post('/', requireRole('admin', 'owner'), async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const userId = c.get('userId');
  const role = c.get('userRole');
  const data = parsed.data;

  // Only admin can assign a different owner_id
  const ownerId = role === 'admin' && data.owner_id ? data.owner_id : userId;

  const id = nanoid();

  await c.env.DB
    .prepare(
      `INSERT INTO properties (id, owner_id, name, type, address, city, area_m2, year_built, structure, floors, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id, ownerId, data.name, data.type, data.address, data.city,
      data.area_m2 ?? null, data.year_built ?? null, data.structure ?? null, data.floors
    )
    .run();

  const property = await c.env.DB
    .prepare('SELECT * FROM properties WHERE id = ?')
    .bind(id)
    .first<Property>();

  await writeAuditLog(c.env.DB, {
    entityType: 'property',
    entityId: id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: property,
  });

  return ok(c, { property }, 201);
});

// ── GET /properties/:id ──────────────────────────────────────────────────────

properties.get('/:id', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const property = await c.env.DB
    .prepare(
      `SELECT p.*, u.name as owner_name FROM properties p
       JOIN users u ON u.id = p.owner_id
       WHERE p.id = ? AND p.deleted_at IS NULL`
    )
    .bind(id)
    .first<Property & { owner_name: string }>();

  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  return ok(c, { property });
});

// ── PUT /properties/:id ──────────────────────────────────────────────────────

properties.put('/:id', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const old = await c.env.DB
    .prepare('SELECT * FROM properties WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Property>();

  if (!old) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const data = parsed.data;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)       { fields.push('name = ?');        values.push(data.name); }
  if (data.type !== undefined)       { fields.push('type = ?');        values.push(data.type); }
  if (data.address !== undefined)    { fields.push('address = ?');     values.push(data.address); }
  if (data.city !== undefined)       { fields.push('city = ?');        values.push(data.city); }
  if (data.area_m2 !== undefined)    { fields.push('area_m2 = ?');     values.push(data.area_m2); }
  if (data.year_built !== undefined) { fields.push('year_built = ?');  values.push(data.year_built); }
  if (data.structure !== undefined)  { fields.push('structure = ?');   values.push(data.structure); }
  if (data.floors !== undefined)     { fields.push('floors = ?');      values.push(data.floors); }
  if (data.cover_url !== undefined)  { fields.push('cover_url = ?');   values.push(data.cover_url); }

  if (fields.length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await c.env.DB
    .prepare(`UPDATE properties SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();

  const updated = await c.env.DB
    .prepare('SELECT * FROM properties WHERE id = ?')
    .bind(id)
    .first<Property>();

  await writeAuditLog(c.env.DB, {
    entityType: 'property',
    entityId: id,
    action: 'update',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: updated,
  });

  return ok(c, { property: updated });
});

// ── DELETE /properties/:id (soft-delete) ─────────────────────────────────────

properties.delete('/:id', requireRole('admin', 'owner'), async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM properties WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Property>();

  if (!old) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  await c.env.DB
    .prepare(`UPDATE properties SET deleted_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'property',
    entityId: id,
    action: 'delete',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

// ── POST /properties/:id/cover ───────────────────────────────────────────────

properties.post('/:id/cover', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const validation = validateUpload(file.type, file.size);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId: id, category: 'photos', filename: `cover.${file.name.split('.').pop()}` });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const coverUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await c.env.DB
    .prepare('UPDATE properties SET cover_url = ? WHERE id = ?')
    .bind(coverUrl, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'property', entityId: id, action: 'cover_upload',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: { cover_url: coverUrl },
  });

  return ok(c, { cover_url: coverUrl });
});

// ── GET /properties/:id/dashboard ────────────────────────────────────────────

properties.get('/:id/dashboard', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  // Run all queries in parallel using batch
  const [expensesRow, servicesRow, inventoryRow, propertyRow] = await c.env.DB.batch([
    c.env.DB
      .prepare(
        `SELECT SUM(amount) as total,
         SUM(CASE WHEN reference_month = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as this_month
         FROM expenses WHERE property_id = ? AND deleted_at IS NULL`
      )
      .bind(id),
    c.env.DB
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) as requested,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' OR status = 'verified' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('completed','verified') THEN 1 ELSE 0 END) as urgent_open
         FROM service_orders WHERE property_id = ? AND deleted_at IS NULL`
      )
      .bind(id),
    c.env.DB
      .prepare(
        `SELECT COUNT(*) as total,
         SUM(CASE WHEN quantity <= reserve_qty THEN 1 ELSE 0 END) as low_stock
         FROM inventory_items WHERE property_id = ? AND deleted_at IS NULL`
      )
      .bind(id),
    c.env.DB
      .prepare('SELECT health_score FROM properties WHERE id = ? AND deleted_at IS NULL')
      .bind(id),
  ]);

  // Monthly expenses for chart (last 6 months)
  const { results: monthlyExpenses } = await c.env.DB
    .prepare(
      `SELECT reference_month, SUM(amount) as total, category
       FROM expenses
       WHERE property_id = ? AND deleted_at IS NULL
         AND reference_month >= strftime('%Y-%m', 'now', '-5 months')
       GROUP BY reference_month, category
       ORDER BY reference_month ASC`
    )
    .bind(id)
    .all<{ reference_month: string; total: number; category: string }>();

  type ExpRow = { total: number; this_month: number };
  type SvcRow = { total: number; requested: number; in_progress: number; done: number; urgent_open: number };
  type InvRow = { total: number; low_stock: number };
  type PropRow = { health_score: number };

  const exp = (expensesRow as unknown as { results: ExpRow[] }).results[0] ?? { total: 0, this_month: 0 };
  const svc = (servicesRow as unknown as { results: SvcRow[] }).results[0] ?? { total: 0, requested: 0, in_progress: 0, done: 0, urgent_open: 0 };
  const inv = (inventoryRow as unknown as { results: InvRow[] }).results[0] ?? { total: 0, low_stock: 0 };
  const prop = (propertyRow as unknown as { results: PropRow[] }).results[0];

  return ok(c, {
    health_score: prop?.health_score ?? 50,
    expenses: exp,
    services: svc,
    inventory: inv,
    monthly_expenses: monthlyExpenses,
  });
});

export default properties;
