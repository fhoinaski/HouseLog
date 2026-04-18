import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { err, ok } from '../lib/response';
import { getDb } from '../db/client';
import { properties, propertyCollaborators, providerAvailability, providerEndorsements, providerRatings, serviceOrders, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const marketplace = new Hono<{ Bindings: Bindings; Variables: Variables }>();

marketplace.use('*', authMiddleware);

// ── POST /marketplace/ratings ────────────────────────────────────────────────
// Submete avaliação do prestador após OS concluída.
const ratingSchema = z.object({
  service_order_id: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  quality: z.number().int().min(1).max(5).optional(),
  punctuality: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  price: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

marketplace.post('/ratings', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const parsed = ratingSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;

  // Verifica OS, provider, acesso (requested_by ou dono da property)
  const [os] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      assigned_to: serviceOrders.assignedTo,
      requested_by: serviceOrders.requestedBy,
      status: serviceOrders.status,
      owner_id: properties.ownerId,
      manager_id: properties.managerId,
    })
    .from(serviceOrders)
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(and(eq(serviceOrders.id, b.service_order_id), isNull(serviceOrders.deletedAt)))
    .limit(1) as Array<{
      id: string;
      property_id: string;
      assigned_to: string | null;
      requested_by: string;
      status: string;
      owner_id: string;
      manager_id: string | null;
    }>;
  if (!os) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);
  if (!os.assigned_to) return err(c, 'OS sem prestador', 'VALIDATION_ERROR', 422);
  if (os.status !== 'completed' && os.status !== 'verified') {
    return err(c, 'OS ainda não concluída', 'VALIDATION_ERROR', 422);
  }
  const canRate =
    userId === os.owner_id || userId === os.manager_id || userId === os.requested_by;
  if (!canRate) return err(c, 'Sem permissão para avaliar', 'FORBIDDEN', 403);

  const id = nanoid();
  try {
    await db.insert(providerRatings).values({
      id,
      providerId: os.assigned_to,
      propertyId: os.property_id,
      serviceOrderId: os.id,
      ratedBy: userId,
      stars: b.stars,
      quality: b.quality ?? null,
      punctuality: b.punctuality ?? null,
      communication: b.communication ?? null,
      price: b.price ?? null,
      comment: b.comment ?? null,
    });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return err(c, 'Já avaliado', 'CONFLICT', 409);
    throw e;
  }
  return ok(c, { id, provider_id: os.assigned_to, stars: b.stars }, 201);
});

// GET /marketplace/providers/:providerId/ratings
marketplace.get('/providers/:providerId/ratings', async (c) => {
  const db = getDb(c.env.DB);
  const providerId = c.req.param('providerId');
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      avg_stars: sql<number | null>`AVG(${providerRatings.stars})`,
      avg_quality: sql<number | null>`AVG(${providerRatings.quality})`,
      avg_punctuality: sql<number | null>`AVG(${providerRatings.punctuality})`,
      avg_communication: sql<number | null>`AVG(${providerRatings.communication})`,
      avg_price: sql<number | null>`AVG(${providerRatings.price})`,
    })
    .from(providerRatings)
    .where(eq(providerRatings.providerId, providerId)) as Array<{
      total: number;
      avg_stars: number | null;
      avg_quality: number | null;
      avg_punctuality: number | null;
      avg_communication: number | null;
      avg_price: number | null;
    }>;

  const recent = await db
    .select({
      stars: providerRatings.stars,
      comment: providerRatings.comment,
      created_at: providerRatings.createdAt,
    })
    .from(providerRatings)
    .where(eq(providerRatings.providerId, providerId))
    .orderBy(desc(providerRatings.createdAt))
    .limit(20);

  return ok(c, { stats: stats ?? null, recent });
});

// GET /marketplace/providers/:providerId/profile
// Perfil público do prestador para dono/gestor avaliar histórico e qualidade.
marketplace.get('/providers/:providerId/profile', async (c) => {
  const db = getDb(c.env.DB);
  const providerId = c.req.param('providerId');

  const [provider] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      whatsapp: users.whatsapp,
      service_area: users.serviceArea,
      provider_bio: users.providerBio,
      provider_courses: users.providerCourses,
      provider_specializations: users.providerSpecializations,
      provider_portfolio: users.providerPortfolio,
      provider_education: users.providerEducation,
      provider_portfolio_cases: users.providerPortfolioCases,
      provider_categories: users.providerCategories,
    })
    .from(users)
    .where(and(eq(users.id, providerId), eq(users.role, 'provider'), isNull(users.deletedAt)))
    .limit(1);

  if (!provider) return err(c, 'Prestador não encontrado', 'NOT_FOUND', 404);

  const [ratingStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      avg_stars: sql<number | null>`AVG(${providerRatings.stars})`,
      avg_quality: sql<number | null>`AVG(${providerRatings.quality})`,
      avg_punctuality: sql<number | null>`AVG(${providerRatings.punctuality})`,
      avg_communication: sql<number | null>`AVG(${providerRatings.communication})`,
      avg_price: sql<number | null>`AVG(${providerRatings.price})`,
    })
    .from(providerRatings)
    .where(eq(providerRatings.providerId, providerId));

  const [endorsements] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(providerEndorsements)
    .where(and(eq(providerEndorsements.providerId, providerId), eq(providerEndorsements.status, 'APPROVED')));

  const recentAnonymous = await db
    .select({
      stars: providerRatings.stars,
      quality: providerRatings.quality,
      punctuality: providerRatings.punctuality,
      communication: providerRatings.communication,
      price: providerRatings.price,
      comment: providerRatings.comment,
      created_at: providerRatings.createdAt,
    })
    .from(providerRatings)
    .where(eq(providerRatings.providerId, providerId))
    .orderBy(desc(providerRatings.createdAt))
    .limit(20);

  return ok(c, {
    provider,
    score: {
      total_ratings: Number(ratingStats?.total ?? 0),
      avg_stars: ratingStats?.avg_stars ?? null,
      avg_quality: ratingStats?.avg_quality ?? null,
      avg_punctuality: ratingStats?.avg_punctuality ?? null,
      avg_communication: ratingStats?.avg_communication ?? null,
      avg_price: ratingStats?.avg_price ?? null,
      endorsements: Number(endorsements?.total ?? 0),
      top_score: Number((ratingStats?.avg_stars ?? 0) * 20 + Number(endorsements?.total ?? 0)),
    },
    reviews: recentAnonymous,
  });
});

const endorseSchema = z.object({
  provider_id: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

// POST /marketplace/providers/endorse
// Endosso inicial de qualidade (owner/admin) para prestador já conhecido.
marketplace.post('/providers/endorse', async (c) => {
  const db = getDb(c.env.DB);
  const actorId = c.get('userId');
  const actorRole = c.get('userRole');

  const parsed = endorseSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const providerId = parsed.data.provider_id;

  const [provider] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, providerId), eq(users.role, 'provider'), isNull(users.deletedAt)))
    .limit(1);
  if (!provider) return err(c, 'Prestador não encontrado', 'NOT_FOUND', 404);

  let canEndorse = actorRole === 'admin';

  if (!canEndorse && actorRole === 'owner') {
    const [linked] = await db
      .select({ id: propertyCollaborators.id })
      .from(propertyCollaborators)
      .innerJoin(properties, eq(properties.id, propertyCollaborators.propertyId))
      .where(
        and(
          eq(properties.ownerId, actorId),
          eq(propertyCollaborators.userId, providerId),
          eq(propertyCollaborators.role, 'provider')
        )
      )
      .limit(1);
    canEndorse = Boolean(linked);
  }

  if (!canEndorse) {
    return err(c, 'Sem permissão para endossar este prestador', 'FORBIDDEN', 403);
  }

  const id = nanoid();
  await db.insert(providerEndorsements).values({
    id,
    providerId,
    endorsedByAdminId: actorId,
    status: 'APPROVED',
    notes: parsed.data.notes ?? null,
    reviewedAt: new Date().toISOString(),
  });

  return ok(c, { id, provider_id: providerId, status: 'APPROVED' }, 201);
});

// ── GET /marketplace/providers/match?category=X&city=Y ───────────────────────
// Matchmaking simples: ordena por rating médio, nº de avaliações, recência.
marketplace.get('/providers/match', async (c) => {
  const db = getDb(c.env.DB);
  const category = c.req.query('category');
  const providers = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(and(eq(users.role, 'provider'), isNull(users.deletedAt)))
    .limit(50);

  const ratingRows = await db
    .select({ providerId: providerRatings.providerId, avg_stars: sql<number>`AVG(${providerRatings.stars})`, total_ratings: sql<number>`COUNT(*)` })
    .from(providerRatings)
    .groupBy(providerRatings.providerId);

  const endorseRows = await db
    .select({ providerId: providerEndorsements.providerId, endorsements: sql<number>`COUNT(*)` })
    .from(providerEndorsements)
    .groupBy(providerEndorsements.providerId);

  const ratingsMap = new Map(ratingRows.map((r) => [r.providerId, r]));
  const endorseMap = new Map(endorseRows.map((r) => [r.providerId, r.endorsements]));

  const rows = providers
    .map((p) => {
      const r = ratingsMap.get(p.id);
      return {
        ...p,
        avg_stars: r?.avg_stars ?? 0,
        total_ratings: r?.total_ratings ?? 0,
        endorsements: endorseMap.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.avg_stars !== a.avg_stars) return b.avg_stars - a.avg_stars;
      if (b.total_ratings !== a.total_ratings) return b.total_ratings - a.total_ratings;
      return b.endorsements - a.endorsements;
    })
    .slice(0, 20);

  // Filtro por categoria é heurístico via endosso ou histórico de OS (pós-MVP).
  // Por ora retorna top global.
  return ok(c, { data: rows, category: category ?? null });
});

// ── Agenda do prestador ──────────────────────────────────────────────────────
const availSchema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  kind: z.enum(['busy', 'available', 'appointment']),
  service_order_id: z.string().optional(),
  notes: z.string().max(500).optional(),
});

marketplace.post('/availability', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const parsed = availSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;
  if (new Date(b.ends_at) <= new Date(b.starts_at)) {
    return err(c, 'ends_at deve ser após starts_at', 'VALIDATION_ERROR', 422);
  }
  const id = nanoid();
  await db.insert(providerAvailability).values({
    id,
    providerId: userId,
    serviceOrderId: b.service_order_id ?? null,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    kind: b.kind,
    notes: b.notes ?? null,
  });
  return ok(c, { id }, 201);
});

marketplace.get('/availability', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const from = c.req.query('from') ?? new Date().toISOString();
  const to =
    c.req.query('to') ?? new Date(Date.now() + 30 * 86_400_000).toISOString();
  const rows = await db
    .select({
      id: providerAvailability.id,
      starts_at: providerAvailability.startsAt,
      ends_at: providerAvailability.endsAt,
      kind: providerAvailability.kind,
      notes: providerAvailability.notes,
      service_order_id: providerAvailability.serviceOrderId,
    })
    .from(providerAvailability)
    .where(
      and(
        eq(providerAvailability.providerId, userId),
        gte(providerAvailability.endsAt, from),
        lte(providerAvailability.startsAt, to)
      )
    )
    .orderBy(asc(providerAvailability.startsAt));
  return ok(c, { data: rows });
});

marketplace.delete('/availability/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id')!;
  const res = await db
    .delete(providerAvailability)
    .where(and(eq(providerAvailability.id, id), eq(providerAvailability.providerId, userId)));
  if (!res.meta.changes) return err(c, 'Não encontrado', 'NOT_FOUND', 404);
  return ok(c, { id });
});

// GET /marketplace/availability/ical — feed iCal do prestador (próprio)
marketplace.get('/availability/ical', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const rows = await db
    .select({
      id: providerAvailability.id,
      starts_at: providerAvailability.startsAt,
      ends_at: providerAvailability.endsAt,
      kind: providerAvailability.kind,
      notes: providerAvailability.notes,
    })
    .from(providerAvailability)
    .where(and(eq(providerAvailability.providerId, userId), gte(providerAvailability.endsAt, sql`datetime('now','-1 day')`)))
    .orderBy(asc(providerAvailability.startsAt))
    .limit(500) as Array<{ id: string; starts_at: string; ends_at: string; kind: string; notes: string | null }>;

  const fmt = (s: string) =>
    new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HouseLog//Provider Agenda//PT',
    'CALSCALE:GREGORIAN',
  ];
  for (const r of rows) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@houselog`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(r.starts_at)}`,
      `DTEND:${fmt(r.ends_at)}`,
      `SUMMARY:HouseLog ${r.kind}`,
      r.notes ? `DESCRIPTION:${r.notes.replace(/\n/g, '\\n')}` : 'DESCRIPTION:',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
});

export default marketplace;
