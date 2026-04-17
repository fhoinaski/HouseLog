import { Hono } from 'hono';
import { ok } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

const search = new Hono<{ Bindings: Bindings; Variables: Variables }>();
search.use('*', authMiddleware);

export type SearchResult = {
  type: 'service' | 'document' | 'inventory' | 'maintenance';
  id: string;
  title: string;
  subtitle: string;
  property_id: string;
  href: string;
};

// GET /search?q=&propertyId=
search.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const propertyId = c.req.query('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  if (q.length < 2) return ok(c, { results: [] as SearchResult[] });

  const like = `%${q}%`;
  const results: SearchResult[] = [];

  // Build reusable access clause and bindings
  const accessBinds: unknown[] = [];
  let accessClause = 'p.deleted_at IS NULL';
  if (role !== 'admin') {
    accessClause += ' AND (p.owner_id = ? OR p.manager_id = ?)';
    accessBinds.push(userId, userId);
  }
  if (propertyId) {
    accessClause += ' AND p.id = ?';
    accessBinds.push(propertyId);
  }

  // Service orders — title, description, system_type
  const { results: svcs } = await c.env.DB.prepare(`
    SELECT s.id, s.title, s.system_type, s.property_id, p.name AS property_name
    FROM service_orders s
    JOIN properties p ON p.id = s.property_id
    WHERE ${accessClause} AND s.deleted_at IS NULL
      AND (s.title LIKE ? OR s.description LIKE ? OR s.system_type LIKE ?)
    LIMIT 5
  `).bind(...accessBinds, like, like, like).all<{
    id: string; title: string; system_type: string;
    property_id: string; property_name: string;
  }>();

  for (const s of svcs) {
    results.push({
      type: 'service', id: s.id, title: s.title,
      subtitle: `${s.system_type} · ${s.property_name}`,
      property_id: s.property_id,
      href: `/properties/${s.property_id}/services/${s.id}`,
    });
  }

  // Documents — title and OCR extracted text
  const { results: docs } = await c.env.DB.prepare(`
    SELECT d.id, d.title, d.type, d.property_id, p.name AS property_name
    FROM documents d
    JOIN properties p ON p.id = d.property_id
    WHERE ${accessClause} AND d.deleted_at IS NULL
      AND (d.title LIKE ? OR d.ocr_data LIKE ?)
    LIMIT 5
  `).bind(...accessBinds, like, like).all<{
    id: string; title: string; type: string;
    property_id: string; property_name: string;
  }>();

  for (const d of docs) {
    results.push({
      type: 'document', id: d.id, title: d.title,
      subtitle: `${d.type} · ${d.property_name}`,
      property_id: d.property_id,
      href: `/properties/${d.property_id}/documents`,
    });
  }

  // Inventory items — name, brand, category
  const { results: items } = await c.env.DB.prepare(`
    SELECT i.id, i.name, i.category, i.brand, i.property_id, p.name AS property_name
    FROM inventory_items i
    JOIN properties p ON p.id = i.property_id
    WHERE ${accessClause} AND i.deleted_at IS NULL
      AND (i.name LIKE ? OR i.brand LIKE ? OR i.category LIKE ?)
    LIMIT 5
  `).bind(...accessBinds, like, like, like).all<{
    id: string; name: string; category: string; brand: string | null;
    property_id: string; property_name: string;
  }>();

  for (const i of items) {
    results.push({
      type: 'inventory', id: i.id, title: i.name,
      subtitle: `${i.category}${i.brand ? ` · ${i.brand}` : ''} · ${i.property_name}`,
      property_id: i.property_id,
      href: `/properties/${i.property_id}/inventory`,
    });
  }

  // Maintenance schedules — title, system_type
  const { results: maint } = await c.env.DB.prepare(`
    SELECT m.id, m.title, m.system_type, m.property_id, p.name AS property_name
    FROM maintenance_schedules m
    JOIN properties p ON p.id = m.property_id
    WHERE ${accessClause} AND m.deleted_at IS NULL
      AND (m.title LIKE ? OR m.system_type LIKE ?)
    LIMIT 5
  `).bind(...accessBinds, like, like).all<{
    id: string; title: string; system_type: string;
    property_id: string; property_name: string;
  }>();

  for (const m of maint) {
    results.push({
      type: 'maintenance', id: m.id, title: m.title,
      subtitle: `${m.system_type} · ${m.property_name}`,
      property_id: m.property_id,
      href: `/properties/${m.property_id}/maintenance`,
    });
  }

  return ok(c, { results });
});

export default search;
