import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import { getDb } from '../db/client';
import { auditLog } from '../db/schema';

const SENSITIVE_KEYS = new Set([
  'secret',
  'ciphertext',
  'encryptedSecret',
  'encrypted_secret',
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'refreshToken',
  'refresh_token',
  'refreshTokenHash',
  'refresh_token_hash',
  'mfaSecret',
  'mfa_secret',
  'fileUrl',
  'file_url',
  'r2Key',
  'r2_key',
  'mediaKey',
  'media_key',
]);

export function sanitizeAuditData(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return { items: value.map((item) => sanitizeAuditValue(item)) };
  }
  if (typeof value !== 'object') {
    return { value };
  }
  return sanitizeAuditValue(value) as Record<string, unknown>;
}

function sanitizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item));
  if (typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = sanitizeAuditValue(nestedValue);
  }
  return result;
}

function readStringField(data: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!data) return undefined;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

export async function writeAuditLog(
  db: D1Database,
  opts: {
    tenantId?: string | null;
    propertyId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    actorIp?: string;
    oldData?: unknown;
    newData?: unknown;
  }
): Promise<void> {
  const drizzle = getDb(db);
  const oldData = sanitizeAuditData(opts.oldData);
  const newData = sanitizeAuditData(opts.newData);
  const tenantId = opts.tenantId ?? readStringField(newData, ['tenant_id', 'tenantId']) ?? readStringField(oldData, ['tenant_id', 'tenantId']) ?? null;
  const propertyId = opts.propertyId ?? readStringField(newData, ['property_id', 'propertyId']) ?? readStringField(oldData, ['property_id', 'propertyId']) ?? null;

  await drizzle.insert(auditLog).values({
    id: nanoid(),
    tenantId,
    propertyId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    action: opts.action,
    actorId: opts.actorId,
    actorIp: opts.actorIp ?? null,
    oldData,
    newData,
  });
}

export function canReadTenantAuditLog(input: {
  activeTenantId?: string | null;
  auditTenantId?: string | null;
}): { allowed: true } | { allowed: false; status: 400 | 404; code: 'TENANT_REQUIRED' | 'NOT_FOUND' } {
  if (!input.activeTenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  if (!input.auditTenantId || input.auditTenantId !== input.activeTenantId) {
    return { allowed: false, status: 404, code: 'NOT_FOUND' };
  }
  return { allowed: true };
}
