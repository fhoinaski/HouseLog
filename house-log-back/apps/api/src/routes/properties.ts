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
// All users (including admin) only see properties they own, manage, or are
// collaborators on. Admins no longer have a blanket "see all" view.

properties.get('/', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const search = c.req.query('search');

  const searchClause = search ? "AND (p.name LIKE ? OR p.city LIKE ?)" : '';
  const cursorClause = cursor ? "AND p.created_at < ?" : '';

  const buildBindings = (base: unknown[]) => {
    const b = [...base];
    if (search) b.push(`%${search}%`, `%${search}%`);
    if (cursor) b.push(cursor);
    b.push(limit + 1);
    return b;
  };

  const fullQuery = `
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM properties p
    JOIN users u ON u.id = p.owner_id
    WHERE p.deleted_at IS NULL
      AND (
        p.owner_id = ? OR p.manager_id = ?
        OR EXISTS (
          SELECT 1 FROM property_collaborators
          WHERE property_id = p.id AND user_id = ?
        )
      )
    ${searchClause} ${cursorClause}
    ORDER BY p.created_at DESC LIMIT ?
  `;

  const fallbackQuery = `
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM properties p
    JOIN users u ON u.id = p.owner_id
    WHERE p.deleted_at IS NULL
      AND (p.owner_id = ? OR p.manager_id = ?)
    ${searchClause} ${cursorClause}
    ORDER BY p.created_at DESC LIMIT ?
  `;

  let results: (Property & { owner_name: string; owner_email: string })[];
  try {
    const r = await c.env.DB
      .prepare(fullQuery)
      .bind(...buildBindings([userId, userId, userId]))
      .all<Property & { owner_name: string; owner_email: string }>();
    results = r.results;
  } catch (e) {
    if (String(e).includes('property_collaborators')) {
      const r = await c.env.DB
        .prepare(fallbackQuery)
        .bind(...buildBindings([userId, userId]))
        .all<Property & { owner_name: string; owner_email: string }>();
      results = r.results;
    } else {
      throw e;
    }
  }

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
       WHERE property_id = ? AND deleted_at IS NULL AND type = 'expense'
         AND reference_month >= strftime('%Y-%m', 'now', '-5 months')
       GROUP BY reference_month, category
       ORDER BY reference_month ASC`
    )
    .bind(id)
    .all<{ reference_month: string; total: number; category: string }>();

  // Warranties expiring within 30 days
  const { results: warrantiesExpiring } = await c.env.DB
    .prepare(
      `SELECT id, name, warranty_until,
              CAST(julianday(warranty_until) - julianday('now') AS INTEGER) as days_left
       FROM inventory_items
       WHERE property_id = ? AND deleted_at IS NULL AND warranty_until IS NOT NULL
         AND julianday(warranty_until) - julianday('now') <= 30
         AND julianday(warranty_until) - julianday('now') >= 0
       ORDER BY warranty_until ASC LIMIT 10`
    )
    .bind(id)
    .all<{ id: string; name: string; warranty_until: string; days_left: number }>();

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
    warranties_expiring: warrantiesExpiring,
  });
});

// ── GET /properties/:id/providers ────────────────────────────────────────────
// Returns collaborators with role='provider' — used to populate the OS assignment dropdown.

properties.get('/:id/providers', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { results } = await c.env.DB.prepare(`
    SELECT pc.id as collab_id, pc.user_id, pc.role, pc.can_open_os,
           u.name, u.email, u.phone, u.avatar_url
    FROM property_collaborators pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.property_id = ? AND pc.role = 'provider'
    ORDER BY u.name ASC
  `).bind(id).all<{
    collab_id: string; user_id: string; role: string; can_open_os: number;
    name: string; email: string; phone: string | null; avatar_url: string | null;
  }>();

  return ok(c, { providers: results });
});

// ── POST /properties/:id/apply-template ──────────────────────────────────────

const templateSchema = z.object({
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
});

const TEMPLATES: Record<string, {
  rooms: { name: string; type: string; floor: number }[];
  maintenance: { title: string; system_type: string; frequency: string; description?: string }[];
}> = {
  house: {
    rooms: [
      { name: 'Sala de Estar', type: 'living', floor: 0 },
      { name: 'Cozinha', type: 'kitchen', floor: 0 },
      { name: 'Quarto Principal', type: 'bedroom', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
      { name: 'Garagem', type: 'garage', floor: 0 },
      { name: 'Área de Serviço', type: 'laundry', floor: 0 },
    ],
    maintenance: [
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Limpeza de Calhas', system_type: 'Calhas', frequency: 'semiannual', description: 'Limpeza e desobstrução de calhas' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico e fiações' },
      { title: 'Revisão Hidráulica', system_type: 'Hidráulica', frequency: 'annual', description: 'Inspeção de encanamentos e válvulas' },
    ],
  },
  apt: {
    rooms: [
      { name: 'Sala', type: 'living', floor: 0 },
      { name: 'Cozinha', type: 'kitchen', floor: 0 },
      { name: 'Quarto Principal', type: 'bedroom', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
    ],
    maintenance: [
      { title: 'Manutenção Ar-Condicionado', system_type: 'Climatização', frequency: 'semiannual', description: 'Limpeza de filtros e revisão do sistema' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico e tomadas' },
    ],
  },
  commercial: {
    rooms: [
      { name: 'Recepção', type: 'living', floor: 0 },
      { name: 'Escritório', type: 'other', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
      { name: 'Copa', type: 'kitchen', floor: 0 },
    ],
    maintenance: [
      { title: 'Manutenção Ar-Condicionado', system_type: 'Climatização', frequency: 'quarterly', description: 'Limpeza de filtros e revisão do sistema' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico' },
    ],
  },
  warehouse: {
    rooms: [
      { name: 'Área de Carga', type: 'other', floor: 0 },
      { name: 'Escritório', type: 'other', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
    ],
    maintenance: [
      { title: 'Revisão Estrutural', system_type: 'Estrutura', frequency: 'annual', description: 'Inspeção de telhado, piso e estrutura' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e roedores' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico industrial' },
    ],
  },
};

properties.post('/:id/apply-template', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Template inválido', 'VALIDATION_ERROR', 422);

  const template = TEMPLATES[parsed.data.type];

  function calcNextDue(freq: string): string {
    const days: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, semiannual: 180, annual: 365 };
    const d = new Date();
    d.setDate(d.getDate() + (days[freq] ?? 365));
    return d.toISOString().slice(0, 10);
  }

  const roomInserts = template.rooms.map((r) =>
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO rooms (id, property_id, name, type, floor, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(nanoid(), id, r.name, r.type, r.floor)
  );

  const maintInserts = template.maintenance.map((m) =>
    c.env.DB.prepare(
      `INSERT INTO maintenance_schedules (id, property_id, system_type, title, description, frequency, next_due, auto_create_os, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    ).bind(nanoid(), id, m.system_type, m.title, m.description ?? null, m.frequency, calcNextDue(m.frequency))
  );

  await c.env.DB.batch([...roomInserts, ...maintInserts]);

  return ok(c, { created: { rooms: template.rooms.length, maintenance: template.maintenance.length } }, 201);
});

export default properties;
