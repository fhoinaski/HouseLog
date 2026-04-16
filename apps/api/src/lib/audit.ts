import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';

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
  await db
    .prepare(
      `INSERT INTO audit_log (id, entity_type, entity_id, action, actor_id, actor_ip, old_data, new_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      nanoid(),
      opts.entityType,
      opts.entityId,
      opts.action,
      opts.actorId,
      opts.actorIp ?? null,
      opts.oldData ? JSON.stringify(opts.oldData) : null,
      opts.newData ? JSON.stringify(opts.newData) : null
    )
    .run();
}
