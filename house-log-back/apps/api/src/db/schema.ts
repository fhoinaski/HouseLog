import { relations, sql } from 'drizzle-orm';
import { index, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Existing tables (minimal shape) to enable type-safe relations.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email'),
});

export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name'),
  address: text('address'),
});

export const serviceRequests = sqliteTable(
  'service_requests',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    mediaUrls: text('media_urls', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    status: text('status', { enum: ['OPEN', 'CLOSED'] })
      .notNull()
      .default('OPEN'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    propertyIdx: index('idx_service_requests_property').on(table.propertyId),
    statusIdx: index('idx_service_requests_status').on(table.status),
    requestedByIdx: index('idx_service_requests_requested_by').on(table.requestedBy),
  })
);

export const bids = sqliteTable(
  'bids',
  {
    id: text('id').primaryKey(),
    serviceRequestId: text('service_request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
      .notNull()
      .references(() => users.id),
    amount: real('amount').notNull(),
    scope: text('scope').notNull(), // memorial descritivo
    status: text('status', { enum: ['PENDING', 'ACCEPTED', 'REJECTED'] })
      .notNull()
      .default('PENDING'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    serviceRequestIdx: index('idx_bids_service_request').on(table.serviceRequestId),
    providerIdx: index('idx_bids_provider').on(table.providerId),
  })
);

export const providerEndorsements = sqliteTable(
  'provider_endorsements',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endorsedByAdminId: text('endorsed_by_admin_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] })
      .notNull()
      .default('PENDING'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    reviewedAt: text('reviewed_at'),
  },
  (table) => ({
    providerIdx: index('idx_provider_endorsements_provider').on(table.providerId),
    adminIdx: index('idx_provider_endorsements_admin').on(table.endorsedByAdminId),
    statusIdx: index('idx_provider_endorsements_status').on(table.status),
  })
);

export const propertiesRelations = relations(properties, ({ many }) => ({
  serviceRequests: many(serviceRequests),
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
