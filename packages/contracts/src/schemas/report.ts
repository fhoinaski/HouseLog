import { z } from 'zod';

// ── Sections ──────────────────────────────────────────────────────────────────

export const DossieRoomSchema = z.object({
  name: z.string(),
  type: z.string(),
  floor: z.number().nullable(),
  area_m2: z.number().nullable(),
});

export const DossieInventoryItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  warranty_until: z.string().nullable(),
  brand: z.string().nullable(),
  room_name: z.string().nullable(),
});

export const DossieWarrantySchema = z.object({
  title: z.string(),
  warranty_type: z.string(),
  status: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string(),
  provider_name: z.string().nullable(),
});

export const DossieRenovationSchema = z.object({
  title: z.string(),
  category: z.string(),
  status: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  contractor_name: z.string().nullable(),
  cost: z.number().nullable(),
});

export const DossieServiceOrderSchema = z.object({
  title: z.string(),
  system_type: z.string(),
  status: z.string(),
  priority: z.string(),
  completed_at: z.string().nullable(),
  cost: z.number().nullable(),
});

export const DossieDocumentSchema = z.object({
  title: z.string(),
  type: z.string(),
  issue_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
});

export const DossieMaintenanceScheduleSchema = z.object({
  title: z.string(),
  system_type: z.string(),
  frequency: z.string(),
  last_done: z.string().nullable(),
  next_due: z.string().nullable(),
  responsible: z.string().nullable(),
});

export const DossieTimelineEventSchema = z.object({
  date: z.string(),
  type: z.enum(['service_order', 'renovation', 'document', 'warranty']),
  title: z.string(),
});

export const DossiePropertySchema = z.object({
  name: z.string(),
  type: z.string(),
  address: z.string(),
  city: z.string(),
  area_m2: z.number().nullable(),
  year_built: z.number().nullable(),
  structure: z.string().nullable(),
  floors: z.number().nullable(),
  health_score: z.number().nullable(),
});

// ── Root payload ──────────────────────────────────────────────────────────────

export const DossiePayloadSchema = z.object({
  generated_at: z.string(),
  tenant_name: z.string(),
  issuer_name: z.string(),
  property: DossiePropertySchema,
  rooms: z.array(DossieRoomSchema),
  inventory_items: z.array(DossieInventoryItemSchema),
  warranties: z.array(DossieWarrantySchema),
  renovations: z.array(DossieRenovationSchema),
  service_orders: z.array(DossieServiceOrderSchema),
  documents: z.array(DossieDocumentSchema),
  maintenance_schedules: z.array(DossieMaintenanceScheduleSchema),
  timeline: z.array(DossieTimelineEventSchema),
});

export type DossiePayload = z.infer<typeof DossiePayloadSchema>;
export type DossieRoom = z.infer<typeof DossieRoomSchema>;
export type DossieInventoryItem = z.infer<typeof DossieInventoryItemSchema>;
export type DossieWarranty = z.infer<typeof DossieWarrantySchema>;
export type DossieRenovation = z.infer<typeof DossieRenovationSchema>;
export type DossieServiceOrder = z.infer<typeof DossieServiceOrderSchema>;
export type DossieDocument = z.infer<typeof DossieDocumentSchema>;
export type DossieMaintenanceSchedule = z.infer<typeof DossieMaintenanceScheduleSchema>;
export type DossieTimelineEvent = z.infer<typeof DossieTimelineEventSchema>;
