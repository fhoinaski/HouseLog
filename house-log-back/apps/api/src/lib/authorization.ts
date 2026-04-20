import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { properties, propertyCollaborators } from '../db/schema';
import type { Role } from './types';

export type AuthorizationSubject = {
  userId: string;
  role: Role;
};

export type PropertyAuthorizationInput = AuthorizationSubject & {
  propertyId: string;
};

function isPropertyDashboardRole(role: Role): boolean {
  return role !== 'provider' && role !== 'temp_provider';
}

export async function canAccessProperty(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  if (!isPropertyDashboardRole(input.role)) return false;

  const drizzle = getDb(db);
  const [owned] = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.id, input.propertyId),
        or(eq(properties.ownerId, input.userId), eq(properties.managerId, input.userId)),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);
  if (owned) return true;

  try {
    const [collab] = await drizzle
      .select({ id: propertyCollaborators.id })
      .from(propertyCollaborators)
      .where(
        and(
          eq(propertyCollaborators.propertyId, input.propertyId),
          eq(propertyCollaborators.userId, input.userId)
        )
      )
      .limit(1);
    return !!collab;
  } catch (e) {
    if (String(e).includes('property_collaborators')) return false;
    throw e;
  }
}

export async function canRevealCredentialSecret(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  if (!isPropertyDashboardRole(input.role)) return false;

  const drizzle = getDb(db);
  const [property] = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.id, input.propertyId),
        or(eq(properties.ownerId, input.userId), eq(properties.managerId, input.userId)),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);

  return !!property;
}

export async function canListCredentials(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canCreateCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canUpdateCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canDeleteCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canGenerateTemporaryCredentialAccess(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canRevealCredentialSecret(db, input);
}

export async function canCreateAuditLink(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canMarkMaintenanceDone(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canUploadDocument(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canDeleteDocument(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function canRequestDocumentOCR(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canAccessProperty(db, input);
}

export async function listAccessiblePropertyIds(
  db: D1Database,
  subject: AuthorizationSubject
): Promise<string[]> {
  if (!isPropertyDashboardRole(subject.role)) return [];

  const drizzle = getDb(db);
  const owned = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        or(eq(properties.ownerId, subject.userId), eq(properties.managerId, subject.userId)),
        isNull(properties.deletedAt)
      )
    );

  let collaboratorRows: Array<{ id: string }> = [];
  try {
    collaboratorRows = await drizzle
      .select({ id: propertyCollaborators.propertyId })
      .from(propertyCollaborators)
      .innerJoin(properties, eq(properties.id, propertyCollaborators.propertyId))
      .where(
        and(
          eq(propertyCollaborators.userId, subject.userId),
          isNull(properties.deletedAt)
        )
      );
  } catch (e) {
    if (!String(e).includes('property_collaborators')) throw e;
  }

  return Array.from(new Set([...owned, ...collaboratorRows].map((row) => row.id)));
}
