import { Hono } from 'hono';
import { and, eq, inArray, isNull, like as sqlLike, or } from 'drizzle-orm';
import { ok } from '../lib/response';
import { canAccessProperty, listAccessiblePropertyIds } from '../lib/authorization';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import {
  documents,
  inventoryItems,
  maintenanceSchedules,
  properties,
  serviceOrders,
} from '../db/schema';
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
  const db = getDb(c.env.DB);
  const q = (c.req.query('q') ?? '').trim();
  const propertyId = c.req.query('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  if (q.length < 2) return ok(c, { results: [] as SearchResult[] });

  const pattern = `%${q}%`;
  const results: SearchResult[] = [];

  const accessiblePropertyIds = propertyId
    ? (await canAccessProperty(c.env.DB, { propertyId, userId, role }) ? [propertyId] : [])
    : await listAccessiblePropertyIds(c.env.DB, { userId, role });

  if (accessiblePropertyIds.length === 0) return ok(c, { results });

  const accessFilters = [
    isNull(properties.deletedAt),
    inArray(properties.id, accessiblePropertyIds),
  ];
  if (propertyId) {
    accessFilters.push(eq(properties.id, propertyId));
  }
  const accessWhere = and(...accessFilters);

  // Service orders — title, description, system_type
  const svcs = await db
    .select({
      id: serviceOrders.id,
      title: serviceOrders.title,
      system_type: serviceOrders.systemType,
      property_id: serviceOrders.propertyId,
      property_name: properties.name,
    })
    .from(serviceOrders)
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(
      and(
        accessWhere,
        isNull(serviceOrders.deletedAt),
        or(
          sqlLike(serviceOrders.title, pattern),
          sqlLike(serviceOrders.description, pattern),
          sqlLike(serviceOrders.systemType, pattern)
        )
      )
    )
    .limit(5);

  for (const s of svcs) {
    results.push({
      type: 'service', id: s.id, title: s.title,
      subtitle: `${s.system_type} · ${s.property_name}`,
      property_id: s.property_id,
      href: `/properties/${s.property_id}/services/${s.id}`,
    });
  }

  // Documents — title and OCR extracted text
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      type: documents.type,
      property_id: documents.propertyId,
      property_name: properties.name,
    })
    .from(documents)
    .innerJoin(properties, eq(properties.id, documents.propertyId))
    .where(
      and(
        accessWhere,
        isNull(documents.deletedAt),
        or(sqlLike(documents.title, pattern), sqlLike(documents.ocrData, pattern))
      )
    )
    .limit(5);

  for (const d of docs) {
    results.push({
      type: 'document', id: d.id, title: d.title,
      subtitle: `${d.type} · ${d.property_name}`,
      property_id: d.property_id,
      href: `/properties/${d.property_id}/documents`,
    });
  }

  // Inventory items — name, brand, category
  const items = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      category: inventoryItems.category,
      brand: inventoryItems.brand,
      property_id: inventoryItems.propertyId,
      property_name: properties.name,
    })
    .from(inventoryItems)
    .innerJoin(properties, eq(properties.id, inventoryItems.propertyId))
    .where(
      and(
        accessWhere,
        isNull(inventoryItems.deletedAt),
        or(
          sqlLike(inventoryItems.name, pattern),
          sqlLike(inventoryItems.brand, pattern),
          sqlLike(inventoryItems.category, pattern)
        )
      )
    )
    .limit(5);

  for (const i of items) {
    results.push({
      type: 'inventory', id: i.id, title: i.name,
      subtitle: `${i.category}${i.brand ? ` · ${i.brand}` : ''} · ${i.property_name}`,
      property_id: i.property_id,
      href: `/properties/${i.property_id}/inventory`,
    });
  }

  // Maintenance schedules — title, system_type
  const maint = await db
    .select({
      id: maintenanceSchedules.id,
      title: maintenanceSchedules.title,
      system_type: maintenanceSchedules.systemType,
      property_id: maintenanceSchedules.propertyId,
      property_name: properties.name,
    })
    .from(maintenanceSchedules)
    .innerJoin(properties, eq(properties.id, maintenanceSchedules.propertyId))
    .where(
      and(
        accessWhere,
        isNull(maintenanceSchedules.deletedAt),
        or(
          sqlLike(maintenanceSchedules.title, pattern),
          sqlLike(maintenanceSchedules.systemType, pattern)
        )
      )
    )
    .limit(5);

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
