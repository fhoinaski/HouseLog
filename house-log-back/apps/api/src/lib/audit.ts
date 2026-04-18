import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import { getDb } from '../db/client';
import { auditLog } from '../db/schema';

export async function writeAuditLog(
  db: D1Database,
  opts: {
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
  await drizzle.insert(auditLog).values({
    id: nanoid(),
    entityType: opts.entityType,
    entityId: opts.entityId,
    action: opts.action,
    actorId: opts.actorId,
    actorIp: opts.actorIp ?? null,
    oldData: (opts.oldData as Record<string, unknown> | null | undefined) ?? null,
    newData: (opts.newData as Record<string, unknown> | null | undefined) ?? null,
  });
}
