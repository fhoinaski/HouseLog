import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, requireRole, assertPropertyAccess } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl } from '../lib/r2';
import { getDb } from '../db/client';
import {
  expenses,
  inventoryItems,
  maintenanceSchedules,
  properties as propertiesTable,
  propertyCollaborators,
  rooms,
  serviceOrders,
  users,
} from '../db/schema';
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
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const search = c.req.query('search');

  const filters = [
    isNull(propertiesTable.deletedAt),
    or(
      eq(propertiesTable.ownerId, userId),
      eq(propertiesTable.managerId, userId),
      sql`EXISTS (
        SELECT 1 FROM property_collaborators pc
        WHERE pc.property_id = ${propertiesTable.id} AND pc.user_id = ${userId}
      )`
    ),
  ];

  if (search) {
    filters.push(
      or(
        sql`${propertiesTable.name} LIKE ${`%${search}%`}`,
        sql`${propertiesTable.city} LIKE ${`%${search}%`}`
      )
    );
  }

  if (cursor) filters.push(sql`${propertiesTable.createdAt} < ${cursor}`);

  const results = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
      owner_name: users.name,
      owner_email: users.email,
    })
    .from(propertiesTable)
    .innerJoin(users, eq(users.id, propertiesTable.ownerId))
    .where(and(...filters))
    .orderBy(desc(propertiesTable.createdAt))
    .limit(limit + 1) as Array<Property & { owner_name: string; owner_email: string }>;

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties ────────────────────────────────────────────────────────

properties.post('/', requireRole('admin', 'owner'), async (c) => {
  const db = getDb(c.env.DB);
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

  await db.insert(propertiesTable).values({
    id,
    ownerId,
    name: data.name,
    type: data.type,
    address: data.address,
    city: data.city,
    areaM2: data.area_m2 ?? null,
    yearBuilt: data.year_built ?? null,
    structure: data.structure ?? null,
    floors: data.floors,
  });

  const [property] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, id))
    .limit(1) as Array<Property>;

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
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const [property] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
      owner_name: users.name,
    })
    .from(propertiesTable)
    .innerJoin(users, eq(users.id, propertiesTable.ownerId))
    .where(and(eq(propertiesTable.id, id), isNull(propertiesTable.deletedAt)))
    .limit(1) as Array<Property & { owner_name: string }>;

  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  return ok(c, { property });
});

// ── PUT /properties/:id ──────────────────────────────────────────────────────

properties.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
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

  const [old] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), isNull(propertiesTable.deletedAt)))
    .limit(1) as Array<Property>;

  if (!old) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const data = parsed.data;
  const updateData: Partial<typeof propertiesTable.$inferInsert> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.area_m2 !== undefined) updateData.areaM2 = data.area_m2;
  if (data.year_built !== undefined) updateData.yearBuilt = data.year_built;
  if (data.structure !== undefined) updateData.structure = data.structure ?? null;
  if (data.floors !== undefined) updateData.floors = data.floors;
  if (data.cover_url !== undefined) updateData.coverUrl = data.cover_url ?? null;

  if (Object.keys(updateData).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db.update(propertiesTable).set(updateData).where(eq(propertiesTable.id, id));

  const [updated] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, id))
    .limit(1) as Array<Property>;

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
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), isNull(propertiesTable.deletedAt)))
    .limit(1) as Array<Property>;

  if (!old) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  await db.update(propertiesTable).set({ deletedAt: sql`datetime('now')` }).where(eq(propertiesTable.id, id));

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
  const db = getDb(c.env.DB);
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

  await db.update(propertiesTable).set({ coverUrl }).where(eq(propertiesTable.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'property', entityId: id, action: 'cover_upload',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: { cover_url: coverUrl },
  });

  return ok(c, { cover_url: coverUrl });
});

// ── GET /properties/:id/dashboard ────────────────────────────────────────────

properties.get('/:id/dashboard', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const [exp, svc, inv, prop] = await Promise.all([
    db
      .select({
        total: sql<number>`SUM(${expenses.amount})`,
        this_month: sql<number>`SUM(CASE WHEN ${expenses.referenceMonth} = strftime('%Y-%m', 'now') THEN ${expenses.amount} ELSE 0 END)`,
      })
      .from(expenses)
      .where(and(eq(expenses.propertyId, id), isNull(expenses.deletedAt)))
      .then((r) => r[0] ?? { total: 0, this_month: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        requested: sql<number>`SUM(CASE WHEN ${serviceOrders.status} = 'requested' THEN 1 ELSE 0 END)`,
        in_progress: sql<number>`SUM(CASE WHEN ${serviceOrders.status} = 'in_progress' THEN 1 ELSE 0 END)`,
        done: sql<number>`SUM(CASE WHEN ${serviceOrders.status} IN ('completed','verified') THEN 1 ELSE 0 END)`,
        urgent_open: sql<number>`SUM(CASE WHEN ${serviceOrders.priority} = 'urgent' AND ${serviceOrders.status} NOT IN ('completed','verified') THEN 1 ELSE 0 END)`,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.propertyId, id), isNull(serviceOrders.deletedAt)))
      .then((r) => r[0] ?? { total: 0, requested: 0, in_progress: 0, done: 0, urgent_open: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        low_stock: sql<number>`SUM(CASE WHEN ${inventoryItems.quantity} <= ${inventoryItems.reserveQty} THEN 1 ELSE 0 END)`,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.propertyId, id), isNull(inventoryItems.deletedAt)))
      .then((r) => r[0] ?? { total: 0, low_stock: 0 }),
    db
      .select({ health_score: propertiesTable.healthScore })
      .from(propertiesTable)
      .where(and(eq(propertiesTable.id, id), isNull(propertiesTable.deletedAt)))
      .limit(1)
      .then((r) => r[0]),
  ]);

  // Monthly expenses for chart (last 6 months)
  const monthlyExpenses = await db
    .select({
      reference_month: expenses.referenceMonth,
      total: sql<number>`SUM(${expenses.amount})`,
      category: expenses.category,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.propertyId, id),
        isNull(expenses.deletedAt),
        eq(expenses.type, 'expense'),
        gte(expenses.referenceMonth, sql`strftime('%Y-%m', 'now', '-5 months')`)
      )
    )
    .groupBy(expenses.referenceMonth, expenses.category)
    .orderBy(asc(expenses.referenceMonth)) as Array<{ reference_month: string; total: number; category: string }>;

  // Warranties expiring within 30 days
  const warrantiesExpiring = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      warranty_until: inventoryItems.warrantyUntil,
      days_left: sql<number>`CAST(julianday(${inventoryItems.warrantyUntil}) - julianday('now') AS INTEGER)`,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.propertyId, id),
        isNull(inventoryItems.deletedAt),
        isNotNull(inventoryItems.warrantyUntil),
        lte(sql`julianday(${inventoryItems.warrantyUntil}) - julianday('now')`, 30),
        gte(sql`julianday(${inventoryItems.warrantyUntil}) - julianday('now')`, 0)
      )
    )
    .orderBy(asc(inventoryItems.warrantyUntil))
    .limit(10) as Array<{ id: string; name: string; warranty_until: string; days_left: number }>;

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
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select({
      collab_id: propertyCollaborators.id,
      user_id: propertyCollaborators.userId,
      role: propertyCollaborators.role,
      can_open_os: propertyCollaborators.canOpenOs,
      specialties: propertyCollaborators.specialties,
      whatsapp: propertyCollaborators.whatsapp,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatar_url: users.avatarUrl,
    })
    .from(propertyCollaborators)
    .innerJoin(users, eq(users.id, propertyCollaborators.userId))
    .where(and(eq(propertyCollaborators.propertyId, id), eq(propertyCollaborators.role, 'provider')))
    .orderBy(asc(users.name)) as Array<{
    collab_id: string; user_id: string; role: string; can_open_os: number;
    specialties: string | null; whatsapp: string | null;
    name: string; email: string; phone: string | null; avatar_url: string | null;
  }>;

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
  const db = getDb(c.env.DB);
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

  await Promise.all([
    ...template.rooms.map((r) =>
      db
        .insert(rooms)
        .values({ id: nanoid(), propertyId: id, name: r.name, type: r.type as never, floor: r.floor })
        .onConflictDoNothing()
    ),
    ...template.maintenance.map((m) =>
      db.insert(maintenanceSchedules).values({
        id: nanoid(),
        propertyId: id,
        systemType: m.system_type,
        title: m.title,
        description: m.description ?? null,
        frequency: m.frequency as never,
        nextDue: calcNextDue(m.frequency),
        autoCreateOs: 0,
      })
    ),
  ]);

  return ok(c, { created: { rooms: template.rooms.length, maintenance: template.maintenance.length } }, 201);
});

export default properties;
