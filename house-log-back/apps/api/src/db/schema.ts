import { relations, sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
}, (table) => ({
  slugUnique: uniqueIndex('tenants_slug_unique').on(table.slug),
  ownerIdx: index('idx_tenants_owner').on(table.ownerId),
}));

export const tenantMembers = sqliteTable('tenant_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'manager', 'provider', 'temp_provider'] }).notNull(),
  status: text('status', { enum: ['active', 'invited', 'suspended'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
}, (table) => ({
  uniqueTenantUser: uniqueIndex('tenant_members_tenant_user_unique').on(table.tenantId, table.userId),
  tenantIdx: index('idx_tenant_members_tenant').on(table.tenantId),
  userIdx: index('idx_tenant_members_user').on(table.userId),
}));

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  activeTenantId: text('active_tenant_id'),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'owner', 'provider', 'temp_provider'] }).notNull(),
  providerCategories: text('provider_categories', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  serviceArea: text('service_area'),
  pixKey: text('pix_key'),
  pixKeyType: text('pix_key_type', { enum: ['cpf', 'cnpj', 'email', 'phone', 'random'] }),
  providerBio: text('provider_bio'),
  providerCourses: text('provider_courses', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  providerSpecializations: text('provider_specializations', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  providerPortfolio: text('provider_portfolio', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  providerEducation: text('provider_education', { mode: 'json' }).$type<Array<{
    institution: string;
    title: string;
    type: 'college' | 'technical' | 'course' | 'certification' | 'other';
    status: 'in_progress' | 'completed';
    certificationUrl?: string;
  }>>().default(sql`'[]'`),
  providerPortfolioCases: text('provider_portfolio_cases', { mode: 'json' }).$type<Array<{
    title: string;
    description?: string;
    beforeImageUrl?: string;
    afterImageUrl?: string;
  }>>().default(sql`'[]'`),
  avatarUrl: text('avatar_url'),
  notificationPrefs: text('notification_prefs').default(
    '{"os_status":true,"maintenance_due":true,"new_bid":true}'
  ),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  lastLogin: text('last_login'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  emailUnique: uniqueIndex('users_email_unique').on(table.email),
  emailIdx: index('idx_users_email').on(table.email),
}));

export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  ownerId: text('owner_id').notNull().references(() => users.id),
  managerId: text('manager_id').references(() => users.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['house', 'apt', 'commercial', 'warehouse'] }).notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  areaM2: real('area_m2'),
  yearBuilt: integer('year_built'),
  structure: text('structure'),
  floors: integer('floors').default(1),
  coverUrl: text('cover_url'),
  healthScore: integer('health_score').notNull().default(50),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_properties_tenant').on(table.tenantId),
  ownerIdx: index('idx_properties_owner').on(table.ownerId),
}));

export const technicalSystems = sqliteTable('technical_systems', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', {
    enum: [
      'electrical',
      'plumbing',
      'sewage',
      'gas',
      'hvac',
      'solar',
      'automation',
      'network',
      'pool',
      'irrigation',
      'security',
      'fire',
      'waterproofing',
      'roofing',
      'structural',
      'finishes',
      'custom',
    ],
  }).notNull(),
  description: text('description'),
  locationSummary: text('location_summary'),
  responsibleProviderId: text('responsible_provider_id').references(() => users.id),
  installationDate: text('installation_date'),
  lastInspectionAt: text('last_inspection_at'),
  status: text('status', {
    enum: ['active', 'attention', 'critical', 'inactive', 'replaced'],
  }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_technical_systems_tenant').on(table.tenantId),
  propertyIdx: index('idx_technical_systems_property').on(table.propertyId),
  propertyStatusIdx: index('idx_technical_systems_property_status').on(table.propertyId, table.status),
  typeIdx: index('idx_technical_systems_type').on(table.propertyId, table.type),
}));

export const technicalPoints = sqliteTable('technical_points', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  technicalSystemId: text('technical_system_id').references(() => technicalSystems.id),
  roomId: text('room_id').references(() => rooms.id),
  name: text('name').notNull(),
  type: text('type', {
    enum: [
      'valve',
      'pipe',
      'drain',
      'inspection_box',
      'electrical_panel',
      'conduit',
      'outlet',
      'switch',
      'gas_line',
      'hvac_line',
      'network_point',
      'sensor',
      'waterproofing_area',
      'structural_element',
      'other',
    ],
  }).notNull(),
  description: text('description'),
  positionX: real('position_x'),
  positionY: real('position_y'),
  floor: integer('floor').notNull().default(0),
  referenceImageUrl: text('reference_image_url'),
  riskLevel: text('risk_level', { enum: ['low', 'medium', 'high'] }).notNull().default('low'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_technical_points_tenant').on(table.tenantId),
  propertyIdx: index('idx_technical_points_property').on(table.propertyId),
  systemIdx: index('idx_technical_points_system').on(table.technicalSystemId),
  roomIdx: index('idx_technical_points_room').on(table.roomId),
  typeIdx: index('idx_technical_points_type').on(table.propertyId, table.type),
  riskIdx: index('idx_technical_points_risk').on(table.propertyId, table.riskLevel),
}));

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['bedroom', 'bathroom', 'kitchen', 'living', 'garage', 'laundry', 'external', 'roof', 'other'],
  }).notNull(),
  floor: integer('floor').default(0),
  areaM2: real('area_m2'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_rooms_tenant').on(table.tenantId),
  propertyIdx: index('idx_rooms_property').on(table.propertyId),
}));

export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  roomId: text('room_id').references(() => rooms.id),
  category: text('category', {
    enum: ['paint', 'tile', 'waterproof', 'plumbing', 'electrical', 'hardware', 'adhesive', 'sealant', 'other'],
  }).notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  model: text('model'),
  colorCode: text('color_code'),
  lotNumber: text('lot_number'),
  supplier: text('supplier'),
  quantity: real('quantity').default(0),
  unit: text('unit').default('un'),
  reserveQty: real('reserve_qty').default(0),
  storageLoc: text('storage_loc'),
  photoUrl: text('photo_url'),
  qrCode: text('qr_code'),
  pricePaid: real('price_paid'),
  purchaseDate: text('purchase_date'),
  warrantyUntil: text('warranty_until'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_inventory_tenant').on(table.tenantId),
  propertyIdx: index('idx_inventory_property').on(table.propertyId),
  roomIdx: index('idx_inventory_room').on(table.roomId),
  warrantyIdx: index('idx_inventory_warranty').on(table.propertyId, table.warrantyUntil),
}));

export const serviceOrders = sqliteTable('service_orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  roomId: text('room_id').references(() => rooms.id),
  systemType: text('system_type', {
    enum: ['electrical', 'plumbing', 'structural', 'waterproofing', 'painting', 'flooring', 'roofing', 'general'],
  }).notNull(),
  requestedBy: text('requested_by').notNull().references(() => users.id),
  assignedTo: text('assigned_to').references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['urgent', 'normal', 'preventive'] }).notNull().default('normal'),
  status: text('status', { enum: ['requested', 'approved', 'in_progress', 'completed', 'verified'] })
    .notNull()
    .default('requested'),
  cost: real('cost'),
  beforePhotos: text('before_photos', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  afterPhotos: text('after_photos', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  checklist: text('checklist', { mode: 'json' }).$type<Array<{ item: string; done: boolean }>>().default(sql`'[]'`),
  warrantyUntil: text('warranty_until'),
  scheduledAt: text('scheduled_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_services_tenant').on(table.tenantId),
  propertyIdx: index('idx_services_property').on(table.propertyId),
  statusIdx: index('idx_services_status').on(table.status),
  assignedIdx: index('idx_services_assigned').on(table.assignedTo),
}));

export const serviceBids = sqliteTable('service_bids', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  serviceId: text('service_id').notNull().references(() => serviceOrders.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull().references(() => users.id),
  amount: real('amount').notNull(),
  notes: text('notes'),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_service_bids_tenant').on(table.tenantId),
  serviceIdx: index('idx_service_bids_service').on(table.serviceId),
  providerIdx: index('idx_service_bids_provider').on(table.providerId),
}));

export const auditLinks = sqliteTable('audit_links', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  serviceOrderId: text('service_order_id').notNull().references(() => serviceOrders.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  token: text('token').notNull(),
  scope: text('scope', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  expiresAt: text('expires_at').notNull(),
  accessedAt: text('accessed_at'),
  accessorIp: text('accessor_ip'),
  geoLat: real('geo_lat'),
  geoLng: real('geo_lng'),
  status: text('status', { enum: ['active', 'used', 'expired'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_audit_links_tenant').on(table.tenantId),
  tokenUnique: uniqueIndex('audit_links_token_unique').on(table.token),
  tokenIdx: index('idx_audit_links_token').on(table.token),
  serviceIdx: index('idx_audit_links_service').on(table.serviceOrderId),
}));

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  serviceId: text('service_id').references(() => serviceOrders.id),
  type: text('type', { enum: ['invoice', 'manual', 'project', 'contract', 'deed', 'permit', 'insurance', 'other'] }).notNull(),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').default(0),
  ocrData: text('ocr_data', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  vendorCnpj: text('vendor_cnpj'),
  amount: real('amount'),
  issueDate: text('issue_date'),
  expiryDate: text('expiry_date'),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_documents_tenant').on(table.tenantId),
  propertyIdx: index('idx_documents_property').on(table.propertyId),
}));

export const documentIngestionJobs = sqliteTable('document_ingestion_jobs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['queued', 'processing', 'needs_review', 'completed', 'failed', 'cancelled'],
  }).notNull().default('queued'),
  provider: text('provider', {
    enum: ['cloudflare_ai', 'openai', 'anthropic', 'gemini', 'manual', 'none'],
  }).notNull().default('none'),
  modelName: text('model_name'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_document_ingestion_jobs_tenant').on(table.tenantId),
  propertyIdx: index('idx_document_ingestion_jobs_property').on(table.propertyId),
  documentIdx: index('idx_document_ingestion_jobs_document').on(table.documentId),
  statusIdx: index('idx_document_ingestion_jobs_status').on(table.status),
}));

export const documentExtractions = sqliteTable('document_extractions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  jobId: text('job_id').notNull().references(() => documentIngestionJobs.id, { onDelete: 'cascade' }),
  rawText: text('raw_text'),
  rawJson: text('raw_json', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  normalizedJson: text('normalized_json', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  confidenceScore: real('confidence_score'),
  schemaVersion: text('schema_version').notNull().default('v1'),
  modelName: text('model_name'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_document_extractions_tenant').on(table.tenantId),
  propertyIdx: index('idx_document_extractions_property').on(table.propertyId),
  documentIdx: index('idx_document_extractions_document').on(table.documentId),
  jobIdx: index('idx_document_extractions_job').on(table.jobId),
}));

export const documentExtractionReviews = sqliteTable('document_extraction_reviews', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  extractionId: text('extraction_id').notNull().references(() => documentExtractions.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'partially_applied'],
  }).notNull().default('pending'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: text('reviewed_at'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_document_extraction_reviews_tenant').on(table.tenantId),
  propertyIdx: index('idx_document_extraction_reviews_property').on(table.propertyId),
  documentIdx: index('idx_document_extraction_reviews_document').on(table.documentId),
  extractionIdx: index('idx_document_extraction_reviews_extraction').on(table.extractionId),
  statusIdx: index('idx_document_extraction_reviews_status').on(table.status),
}));

export const documentExtractionCandidates = sqliteTable('document_extraction_candidates', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  jobId: text('job_id').notNull().references(() => documentIngestionJobs.id, { onDelete: 'cascade' }),
  extractionId: text('extraction_id').notNull().references(() => documentExtractions.id, { onDelete: 'cascade' }),
  candidateType: text('candidate_type', {
    enum: ['technical_system', 'warranty', 'inventory_item', 'maintenance_recommendation'],
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'applied', 'superseded'],
  }).notNull().default('pending'),
  targetEntityType: text('target_entity_type', {
    enum: ['technical_system', 'warranty', 'inventory_item', 'maintenance_schedule', 'none'],
  }).notNull().default('none'),
  targetEntityId: text('target_entity_id'),
  sourcePath: text('source_path').notNull(),
  payloadJson: text('payload_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  confidenceScore: real('confidence_score'),
  reviewNotes: text('review_notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  appliedAt: text('applied_at'),
  appliedBy: text('applied_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  tenantIdx: index('idx_document_extraction_candidates_tenant').on(table.tenantId),
  propertyIdx: index('idx_document_extraction_candidates_property').on(table.propertyId),
  documentIdx: index('idx_document_extraction_candidates_document').on(table.documentId),
  jobIdx: index('idx_document_extraction_candidates_job').on(table.jobId),
  extractionIdx: index('idx_document_extraction_candidates_extraction').on(table.extractionId),
  candidateTypeIdx: index('idx_document_extraction_candidates_type').on(table.candidateType),
  statusIdx: index('idx_document_extraction_candidates_status').on(table.status),
}));

export const warranties = sqliteTable('warranties', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  serviceOrderId: text('service_order_id').references(() => serviceOrders.id, { onDelete: 'set null' }),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
  inventoryItemId: text('inventory_item_id').references(() => inventoryItems.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  providerName: text('provider_name'),
  warrantyType: text('warranty_type', {
    enum: ['service', 'equipment', 'material', 'structural', 'appliance', 'finish', 'other'],
  }).notNull(),
  startDate: text('start_date'),
  endDate: text('end_date').notNull(),
  status: text('status', { enum: ['active', 'expired', 'claimed', 'void'] }).notNull().default('active'),
  coverage: text('coverage'),
  exclusions: text('exclusions'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_warranties_tenant').on(table.tenantId),
  propertyIdx: index('idx_warranties_property').on(table.propertyId),
  propertyStatusIdx: index('idx_warranties_property_status').on(table.propertyId, table.status),
  typeIdx: index('idx_warranties_type').on(table.propertyId, table.warrantyType),
  endDateIdx: index('idx_warranties_end_date').on(table.propertyId, table.endDate),
  roomIdx: index('idx_warranties_room').on(table.roomId),
  serviceOrderIdx: index('idx_warranties_service_order').on(table.serviceOrderId),
  documentIdx: index('idx_warranties_document').on(table.documentId),
  inventoryItemIdx: index('idx_warranties_inventory_item').on(table.inventoryItemId),
}));

export const renovations = sqliteTable('renovations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  serviceOrderId: text('service_order_id').references(() => serviceOrders.id, { onDelete: 'set null' }),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category', {
    enum: [
      'structural',
      'electrical',
      'plumbing',
      'finishing',
      'layout',
      'roofing',
      'waterproofing',
      'painting',
      'flooring',
      'other',
    ],
  }).notNull(),
  status: text('status', {
    enum: ['planned', 'in_progress', 'completed', 'cancelled'],
  }).notNull().default('planned'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  contractorName: text('contractor_name'),
  contractorId: text('contractor_id').references(() => users.id, { onDelete: 'set null' }),
  cost: real('cost'),
  notes: text('notes'),
  beforePhotos: text('before_photos', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  afterPhotos: text('after_photos', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_renovations_tenant').on(table.tenantId),
  propertyIdx: index('idx_renovations_property').on(table.propertyId),
  propertyStatusIdx: index('idx_renovations_property_status').on(table.propertyId, table.status),
  categoryIdx: index('idx_renovations_category').on(table.propertyId, table.category),
  roomIdx: index('idx_renovations_room').on(table.roomId),
  serviceOrderIdx: index('idx_renovations_service_order').on(table.serviceOrderId),
  documentIdx: index('idx_renovations_document').on(table.documentId),
  contractorIdx: index('idx_renovations_contractor').on(table.contractorId),
  startedAtIdx: index('idx_renovations_started_at').on(table.propertyId, table.startedAt),
  completedAtIdx: index('idx_renovations_completed_at').on(table.propertyId, table.completedAt),
}));

export const handoverPackages = sqliteTable('handover_packages', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type', { enum: ['handover', 'move_in', 'move_out', 'inspection'] }).notNull().default('handover'),
  status: text('status', {
    enum: ['draft', 'in_review', 'approved', 'completed', 'archived'],
  }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  preparedBy: text('prepared_by').notNull().references(() => users.id),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: text('approved_at'),
  completedAt: text('completed_at'),
  summaryDocumentId: text('summary_document_id').references(() => documents.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_handover_packages_tenant').on(table.tenantId),
  propertyIdx: index('idx_handover_packages_property').on(table.propertyId),
  propertyStatusIdx: index('idx_handover_packages_property_status').on(table.propertyId, table.status),
  typeIdx: index('idx_handover_packages_type').on(table.propertyId, table.type),
  reviewedByIdx: index('idx_handover_packages_reviewed_by').on(table.reviewedBy),
  approvedByIdx: index('idx_handover_packages_approved_by').on(table.approvedBy),
  summaryDocumentIdx: index('idx_handover_packages_summary_document').on(table.summaryDocumentId),
  createdAtIdx: index('idx_handover_packages_created_at').on(table.propertyId, table.createdAt),
  completedAtIdx: index('idx_handover_packages_completed_at').on(table.propertyId, table.completedAt),
}));

export const handoverChecklistItems = sqliteTable('handover_checklist_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  handoverPackageId: text('handover_package_id').notNull().references(() => handoverPackages.id, { onDelete: 'cascade' }),
  roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  inventoryItemId: text('inventory_item_id').references(() => inventoryItems.id, { onDelete: 'set null' }),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
  serviceOrderId: text('service_order_id').references(() => serviceOrders.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category', {
    enum: ['keys', 'documents', 'utilities', 'inventory', 'cleaning', 'maintenance', 'safety', 'general'],
  }).notNull().default('general'),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  status: text('status', { enum: ['pending', 'done', 'issue', 'not_applicable'] }).notNull().default('pending'),
  condition: text('condition', { enum: ['new', 'good', 'fair', 'poor', 'damaged'] }),
  evidenceUrls: text('evidence_urls', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  completedBy: text('completed_by').references(() => users.id, { onDelete: 'set null' }),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_handover_items_tenant').on(table.tenantId),
  propertyIdx: index('idx_handover_items_property').on(table.propertyId),
  packageIdx: index('idx_handover_items_package').on(table.handoverPackageId),
  packageStatusIdx: index('idx_handover_items_package_status').on(table.handoverPackageId, table.status),
  packageSortIdx: index('idx_handover_items_package_sort').on(table.handoverPackageId, table.sortOrder, table.createdAt),
  roomIdx: index('idx_handover_items_room').on(table.roomId),
  inventoryIdx: index('idx_handover_items_inventory').on(table.inventoryItemId),
  documentIdx: index('idx_handover_items_document').on(table.documentId),
  serviceOrderIdx: index('idx_handover_items_service_order').on(table.serviceOrderId),
  completedByIdx: index('idx_handover_items_completed_by').on(table.completedBy),
}));

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  category: text('category', {
    enum: ['water', 'electricity', 'gas', 'condo', 'iptu', 'insurance', 'cleaning', 'garden', 'security', 'other'],
  }).notNull(),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['expense', 'revenue'] }).notNull().default('expense'),
  referenceMonth: text('reference_month').notNull(),
  isRecurring: integer('is_recurring').notNull().default(0),
  recurrenceGroup: text('recurrence_group'),
  receiptUrl: text('receipt_url'),
  notes: text('notes'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_expenses_tenant').on(table.tenantId),
  propertyIdx: index('idx_expenses_property').on(table.propertyId),
  monthIdx: index('idx_expenses_month').on(table.propertyId, table.referenceMonth),
}));

export const maintenanceSchedules = sqliteTable('maintenance_schedules', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  systemType: text('system_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  frequency: text('frequency', { enum: ['weekly', 'monthly', 'quarterly', 'semiannual', 'annual'] }).notNull(),
  lastDone: text('last_done'),
  nextDue: text('next_due'),
  responsible: text('responsible'),
  autoCreateOs: integer('auto_create_os').default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_schedules_tenant').on(table.tenantId),
  propertyIdx: index('idx_schedules_property').on(table.propertyId),
}));

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').references(() => properties.id),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  actorId: text('actor_id').references(() => users.id),
  actorIp: text('actor_ip'),
  oldData: text('old_data', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  newData: text('new_data', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_audit_log_tenant').on(table.tenantId),
  propertyIdx: index('idx_audit_log_property').on(table.propertyId),
  entityIdx: index('idx_audit_log_entity').on(table.entityType, table.entityId),
  actorIdx: index('idx_audit_log_actor').on(table.actorId),
  createdIdx: index('idx_audit_log_created').on(table.createdAt),
}));

export const propertyCollaborators = sqliteTable('property_collaborators', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['viewer', 'provider', 'manager'] }).notNull().default('viewer'),
  invitedBy: text('invited_by').references(() => users.id),
  canOpenOs: integer('can_open_os').notNull().default(0),
  specialties: text('specialties', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  whatsapp: text('whatsapp'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_collaborators_tenant').on(table.tenantId),
  uniquePropertyUser: uniqueIndex('property_collaborators_property_user_unique').on(table.propertyId, table.userId),
  propertyIdx: index('idx_collaborators_property').on(table.propertyId),
  userIdx: index('idx_collaborators_user').on(table.userId),
}));

export const propertyInvites = sqliteTable('property_invites', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  email: text('email').notNull(),
  role: text('role', { enum: ['viewer', 'provider', 'manager'] }).notNull().default('viewer'),
  token: text('token').notNull(),
  inviteName: text('invite_name'),
  specialties: text('specialties', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  whatsapp: text('whatsapp'),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_invites_tenant').on(table.tenantId),
  tokenUnique: uniqueIndex('property_invites_token_unique').on(table.token),
  tokenIdx: index('idx_invites_token').on(table.token),
  propertyIdx: index('idx_invites_property').on(table.propertyId),
}));

export const serviceShareLinks = sqliteTable('service_share_links', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  serviceId: text('service_id').notNull().references(() => serviceOrders.id),
  token: text('token').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  providerName: text('provider_name'),
  providerEmail: text('provider_email'),
  providerPhone: text('provider_phone'),
  providerAcceptedAt: text('provider_accepted_at'),
  providerStartedAt: text('provider_started_at'),
  providerDoneAt: text('provider_done_at'),
  notesFromProvider: text('notes_from_provider'),
  shareCredentials: integer('share_credentials').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tokenUnique: uniqueIndex('service_share_links_token_unique').on(table.token),
}));

export const propertyAccessCredentials = sqliteTable('property_access_credentials', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  category: text('category').notNull().default('other'),
  label: text('label').notNull(),
  username: text('username'),
  secret: text('secret').notNull(),
  notes: text('notes'),
  integrationType: text('integration_type'),
  integrationConfig: text('integration_config', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  shareWithOs: integer('share_with_os').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
});

export const serviceRequests = sqliteTable('service_requests', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  requestedBy: text('requested_by').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  mediaUrls: text('media_urls', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  status: text('status', { enum: ['OPEN', 'CLOSED'] }).notNull().default('OPEN'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_service_requests_tenant').on(table.tenantId),
  propertyIdx: index('idx_service_requests_property').on(table.propertyId),
  statusIdx: index('idx_service_requests_status').on(table.status),
  requestedByIdx: index('idx_service_requests_requested_by').on(table.requestedBy),
}));

export const bids = sqliteTable('bids', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  serviceRequestId: text('service_request_id').notNull().references(() => serviceRequests.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull().references(() => users.id),
  amount: real('amount').notNull(),
  scope: text('scope').notNull(),
  status: text('status', { enum: ['PENDING', 'ACCEPTED', 'REJECTED'] }).notNull().default('PENDING'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_bids_tenant').on(table.tenantId),
  serviceRequestIdx: index('idx_bids_service_request').on(table.serviceRequestId),
  providerIdx: index('idx_bids_provider').on(table.providerId),
}));

export const providerEndorsements = sqliteTable('provider_endorsements', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endorsedByAdminId: text('endorsed_by_admin_id').notNull().references(() => users.id),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] }).notNull().default('PENDING'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  reviewedAt: text('reviewed_at'),
}, (table) => ({
  providerIdx: index('idx_provider_endorsements_provider').on(table.providerId),
  adminIdx: index('idx_provider_endorsements_admin').on(table.endorsedByAdminId),
  statusIdx: index('idx_provider_endorsements_status').on(table.status),
}));

export const refreshTokens = sqliteTable('refresh_tokens', {
  jti: text('jti').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyId: text('family_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  issuedAt: text('issued_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  replacedBy: text('replaced_by'),
  userAgent: text('user_agent'),
  ip: text('ip'),
}, (table) => ({
  userIdx: index('idx_refresh_tokens_user').on(table.userId),
  familyIdx: index('idx_refresh_tokens_family').on(table.familyId),
  expiresIdx: index('idx_refresh_tokens_expires').on(table.expiresAt),
}));

export const userMfa = sqliteTable('user_mfa', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  enabledAt: text('enabled_at'),
  lastUsedAt: text('last_used_at'),
  backupCodes: text('backup_codes', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const mfaChallenges = sqliteTable('mfa_challenges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  consumedAt: text('consumed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index('idx_mfa_challenges_user').on(table.userId),
}));

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastUsedAt: text('last_used_at'),
}, (table) => ({
  endpointUnique: uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
  userIdx: index('idx_push_subs_user').on(table.userId),
}));

export const imageVariants = sqliteTable('image_variants', {
  r2Key: text('r2_key').primaryKey(),
  thumbKey: text('thumb_key'),
  mediumKey: text('medium_key'),
  width: integer('width'),
  height: integer('height'),
  processedAt: text('processed_at').notNull().default(sql`(datetime('now'))`),
});

export const serviceMessages = sqliteTable('service_messages', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  serviceOrderId: text('service_order_id').notNull().references(() => serviceOrders.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  internal: integer('internal').notNull().default(0),
  attachments: text('attachments', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => ({
  tenantIdx: index('idx_service_messages_tenant').on(table.tenantId),
  serviceIdx: index('idx_service_messages_service').on(table.serviceOrderId),
  createdIdx: index('idx_service_messages_created').on(table.serviceOrderId, table.createdAt),
}));

export const providerRatings = sqliteTable('provider_ratings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  providerId: text('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  serviceOrderId: text('service_order_id').notNull().references(() => serviceOrders.id, { onDelete: 'cascade' }),
  ratedBy: text('rated_by').notNull().references(() => users.id),
  stars: integer('stars').notNull(),
  quality: integer('quality'),
  punctuality: integer('punctuality'),
  communication: integer('communication'),
  price: integer('price'),
  comment: text('comment'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  tenantIdx: index('idx_provider_ratings_tenant').on(table.tenantId),
  uniqueServiceRatedBy: uniqueIndex('provider_ratings_service_rated_by_unique').on(table.serviceOrderId, table.ratedBy),
  providerIdx: index('idx_provider_ratings_provider').on(table.providerId),
}));

export const providerAvailability = sqliteTable('provider_availability', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceOrderId: text('service_order_id').references(() => serviceOrders.id, { onDelete: 'set null' }),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  kind: text('kind', { enum: ['busy', 'available', 'appointment'] }).notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  rangeIdx: index('idx_provider_avail_range').on(table.providerId, table.startsAt, table.endsAt),
}));

export const pixCharges = sqliteTable('pix_charges', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  serviceOrderId: text('service_order_id').references(() => serviceOrders.id, { onDelete: 'set null' }),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => users.id),
  pixKey: text('pix_key').notNull(),
  pixKeyType: text('pix_key_type', { enum: ['cpf', 'cnpj', 'email', 'phone', 'random'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  merchantName: text('merchant_name').notNull(),
  merchantCity: text('merchant_city').notNull(),
  txid: text('txid').notNull(),
  brCode: text('br_code').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'paid', 'cancelled', 'expired'] }).notNull().default('pending'),
  paidAt: text('paid_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  txidUnique: uniqueIndex('pix_charges_txid_unique').on(table.txid),
  serviceIdx: index('idx_pix_charges_service').on(table.serviceOrderId),
  propertyIdx: index('idx_pix_charges_property').on(table.propertyId),
}));

export const aiCache = sqliteTable('ai_cache', {
  cacheKey: text('cache_key').primaryKey(),
  kind: text('kind').notNull(),
  result: text('result').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const nfeImports = sqliteTable('nfe_imports', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
  expenseId: text('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  chaveAcesso: text('chave_acesso'),
  cnpjEmitente: text('cnpj_emitente'),
  nomeEmitente: text('nome_emitente'),
  valorTotal: real('valor_total'),
  dataEmissao: text('data_emissao'),
  rawSummary: text('raw_summary', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  chaveUnique: uniqueIndex('nfe_imports_chave_acesso_unique').on(table.chaveAcesso),
  propertyIdx: index('idx_nfe_property').on(table.propertyId),
}));

export const propertiesRelations = relations(properties, ({ many }) => ({
  serviceRequests: many(serviceRequests),
}));

export const documentIngestionJobsRelations = relations(documentIngestionJobs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [documentIngestionJobs.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [documentIngestionJobs.propertyId],
    references: [properties.id],
  }),
  document: one(documents, {
    fields: [documentIngestionJobs.documentId],
    references: [documents.id],
  }),
  extractions: many(documentExtractions),
}));

export const documentExtractionsRelations = relations(documentExtractions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [documentExtractions.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [documentExtractions.propertyId],
    references: [properties.id],
  }),
  document: one(documents, {
    fields: [documentExtractions.documentId],
    references: [documents.id],
  }),
  job: one(documentIngestionJobs, {
    fields: [documentExtractions.jobId],
    references: [documentIngestionJobs.id],
  }),
  reviews: many(documentExtractionReviews),
}));

export const documentExtractionReviewsRelations = relations(documentExtractionReviews, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documentExtractionReviews.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [documentExtractionReviews.propertyId],
    references: [properties.id],
  }),
  document: one(documents, {
    fields: [documentExtractionReviews.documentId],
    references: [documents.id],
  }),
  extraction: one(documentExtractions, {
    fields: [documentExtractionReviews.extractionId],
    references: [documentExtractions.id],
  }),
  reviewer: one(users, {
    fields: [documentExtractionReviews.reviewedBy],
    references: [users.id],
  }),
}));

export const documentExtractionCandidatesRelations = relations(documentExtractionCandidates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documentExtractionCandidates.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [documentExtractionCandidates.propertyId],
    references: [properties.id],
  }),
  document: one(documents, {
    fields: [documentExtractionCandidates.documentId],
    references: [documents.id],
  }),
  job: one(documentIngestionJobs, {
    fields: [documentExtractionCandidates.jobId],
    references: [documentIngestionJobs.id],
  }),
  extraction: one(documentExtractions, {
    fields: [documentExtractionCandidates.extractionId],
    references: [documentExtractions.id],
  }),
  applier: one(users, {
    fields: [documentExtractionCandidates.appliedBy],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  requestedServiceRequests: many(serviceRequests),
  bids: many(bids),
  endorsementsAsProvider: many(providerEndorsements, {
    relationName: 'endorsement_provider',
  }),
  endorsementsAsAdmin: many(providerEndorsements, {
    relationName: 'endorsement_admin',
  }),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one, many }) => ({
  property: one(properties, {
    fields: [serviceRequests.propertyId],
    references: [properties.id],
  }),
  requester: one(users, {
    fields: [serviceRequests.requestedBy],
    references: [users.id],
  }),
  bids: many(bids),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  serviceRequest: one(serviceRequests, {
    fields: [bids.serviceRequestId],
    references: [serviceRequests.id],
  }),
  provider: one(users, {
    fields: [bids.providerId],
    references: [users.id],
  }),
}));

export const providerEndorsementsRelations = relations(providerEndorsements, ({ one }) => ({
  provider: one(users, {
    fields: [providerEndorsements.providerId],
    references: [users.id],
    relationName: 'endorsement_provider',
  }),
  endorsedByAdmin: one(users, {
    fields: [providerEndorsements.endorsedByAdminId],
    references: [users.id],
    relationName: 'endorsement_admin',
  }),
}));
