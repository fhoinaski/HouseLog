import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authMiddleware } from '../middleware/auth';
import { err, ok } from '../lib/response';
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
  const userId = c.get('userId');
  const parsed = ratingSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;

  // Verifica OS, provider, acesso (requested_by ou dono da property)
  const os = await c.env.DB
    .prepare(
      `SELECT s.id, s.property_id, s.assigned_to, s.requested_by, s.status,
              p.owner_id, p.manager_id
       FROM service_orders s
       JOIN properties p ON p.id = s.property_id
       WHERE s.id = ? AND s.deleted_at IS NULL`
    )
    .bind(b.service_order_id)
    .first<{
      id: string;
      property_id: string;
      assigned_to: string | null;
      requested_by: string;
      status: string;
      owner_id: string;
      manager_id: string | null;
    }>();
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
    await c.env.DB
      .prepare(
        `INSERT INTO provider_ratings
         (id, provider_id, property_id, service_order_id, rated_by,
          stars, quality, punctuality, communication, price, comment)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        id,
        os.assigned_to,
        os.property_id,
        os.id,
        userId,
        b.stars,
        b.quality ?? null,
        b.punctuality ?? null,
        b.communication ?? null,
        b.price ?? null,
        b.comment ?? null
      )
      .run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) return err(c, 'Já avaliado', 'CONFLICT', 409);
    throw e;
  }
  return ok(c, { id, provider_id: os.assigned_to, stars: b.stars }, 201);
});

// GET /marketplace/providers/:providerId/ratings
marketplace.get('/providers/:providerId/ratings', async (c) => {
  const providerId = c.req.param('providerId');
  const stats = await c.env.DB
    .prepare(
      `SELECT COUNT(*) AS total,
              AVG(stars) AS avg_stars,
              AVG(quality) AS avg_quality,
              AVG(punctuality) AS avg_punctuality,
              AVG(communication) AS avg_communication,
              AVG(price) AS avg_price
       FROM provider_ratings WHERE provider_id = ?`
    )
    .bind(providerId)
    .first<{
      total: number;
      avg_stars: number | null;
      avg_quality: number | null;
      avg_punctuality: number | null;
      avg_communication: number | null;
      avg_price: number | null;
    }>();

  const recent = await c.env.DB
    .prepare(
      `SELECT r.stars, r.comment, r.created_at, u.name AS rater_name
       FROM provider_ratings r
       JOIN users u ON u.id = r.rated_by
       WHERE r.provider_id = ?
       ORDER BY r.created_at DESC
       LIMIT 20`
    )
    .bind(providerId)
    .all();

  return ok(c, { stats, recent: recent.results ?? [] });
});

// ── GET /marketplace/providers/match?category=X&city=Y ───────────────────────
// Matchmaking simples: ordena por rating médio, nº de avaliações, recência.
marketplace.get('/providers/match', async (c) => {
  const category = c.req.query('category');
  const rows = await c.env.DB
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone,
              COALESCE(rs.avg_stars, 0) AS avg_stars,
              COALESCE(rs.total, 0) AS total_ratings,
              COALESCE(es.count, 0) AS endorsements
       FROM users u
       LEFT JOIN (
         SELECT provider_id, AVG(stars) AS avg_stars, COUNT(*) AS total
         FROM provider_ratings GROUP BY provider_id
       ) rs ON rs.provider_id = u.id
       LEFT JOIN (
         SELECT endorsed_id AS pid, COUNT(*) AS count
         FROM provider_endorsements GROUP BY endorsed_id
       ) es ON es.pid = u.id
       WHERE u.role = 'provider' AND u.deleted_at IS NULL
       ORDER BY avg_stars DESC, total_ratings DESC, endorsements DESC
       LIMIT 20`
    )
    .all();

  // Filtro por categoria é heurístico via endosso ou histórico de OS (pós-MVP).
  // Por ora retorna top global.
  return ok(c, { data: rows.results ?? [], category: category ?? null });
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
  const userId = c.get('userId');
  const parsed = availSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;
  if (new Date(b.ends_at) <= new Date(b.starts_at)) {
    return err(c, 'ends_at deve ser após starts_at', 'VALIDATION_ERROR', 422);
  }
  const id = nanoid();
  await c.env.DB
    .prepare(
      `INSERT INTO provider_availability
       (id, provider_id, service_order_id, starts_at, ends_at, kind, notes)
       VALUES (?,?,?,?,?,?,?)`
    )
    .bind(id, userId, b.service_order_id ?? null, b.starts_at, b.ends_at, b.kind, b.notes ?? null)
    .run();
  return ok(c, { id }, 201);
});

marketplace.get('/availability', async (c) => {
  const userId = c.get('userId');
  const from = c.req.query('from') ?? new Date().toISOString();
  const to =
    c.req.query('to') ?? new Date(Date.now() + 30 * 86_400_000).toISOString();
  const rows = await c.env.DB
    .prepare(
      `SELECT id, starts_at, ends_at, kind, notes, service_order_id
       FROM provider_availability
       WHERE provider_id = ? AND ends_at >= ? AND starts_at <= ?
       ORDER BY starts_at ASC`
    )
    .bind(userId, from, to)
    .all();
  return ok(c, { data: rows.results ?? [] });
});

marketplace.delete('/availability/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const res = await c.env.DB
    .prepare(`DELETE FROM provider_availability WHERE id = ? AND provider_id = ?`)
    .bind(id, userId)
    .run();
  if (!res.meta.changes) return err(c, 'Não encontrado', 'NOT_FOUND', 404);
  return ok(c, { id });
});

// GET /marketplace/availability/ical — feed iCal do prestador (próprio)
marketplace.get('/availability/ical', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB
    .prepare(
      `SELECT id, starts_at, ends_at, kind, notes
       FROM provider_availability
       WHERE provider_id = ? AND ends_at >= datetime('now','-1 day')
       ORDER BY starts_at ASC
       LIMIT 500`
    )
    .bind(userId)
    .all<{ id: string; starts_at: string; ends_at: string; kind: string; notes: string | null }>();

  const fmt = (s: string) =>
    new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HouseLog//Provider Agenda//PT',
    'CALSCALE:GREGORIAN',
  ];
  for (const r of rows.results ?? []) {
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
