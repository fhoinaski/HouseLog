// Refresh token rotativo com detecção de reuso.
// - access_token: JWT curto (existente em lib/jwt.ts, TTL ~1h recomendado)
// - refresh_token: string opaca + family_id. Ao rotacionar, marca o antigo como
//   replaced_by. Se o cliente tentar usar um refresh já rotacionado, revogamos
//   toda a family (possível vazamento).
//
// Armazenamos apenas o HASH (SHA-256) do token — nunca o valor cru.

import { nanoid } from 'nanoid';

const DEFAULT_TTL_DAYS = 30;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(buf);
}

export type RefreshRow = {
  jti: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by: string | null;
};

export async function issueRefreshToken(
  db: D1Database,
  userId: string,
  opts: {
    familyId?: string;
    ttlDays?: number;
    userAgent?: string | null;
    ip?: string | null;
  } = {}
): Promise<{ token: string; jti: string; familyId: string; expiresAt: string }> {
  const jti = nanoid(24);
  const raw = nanoid(48);
  const token = `${jti}.${raw}`;
  const familyId = opts.familyId ?? nanoid(16);
  const ttlDays = opts.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();
  const hash = await sha256Hex(raw);

  await db
    .prepare(
      `INSERT INTO refresh_tokens (jti, user_id, family_id, token_hash, expires_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(jti, userId, familyId, hash, expiresAt, opts.userAgent ?? null, opts.ip ?? null)
    .run();

  return { token, jti, familyId, expiresAt };
}

// Valida e rotaciona. Retorna novo refresh_token ou null em caso de inválido.
// Se detectar reuso (token já replaced), revoga TODA a family.
export async function rotateRefreshToken(
  db: D1Database,
  presented: string,
  opts: { userAgent?: string | null; ip?: string | null } = {}
): Promise<{ userId: string; token: string; jti: string; familyId: string; expiresAt: string } | null> {
  const dot = presented.indexOf('.');
  if (dot < 0) return null;
  const jti = presented.slice(0, dot);
  const raw = presented.slice(dot + 1);
  const hash = await sha256Hex(raw);

  const row = await db
    .prepare(
      `SELECT jti, user_id, family_id, token_hash, expires_at, revoked_at, replaced_by
       FROM refresh_tokens WHERE jti = ?`
    )
    .bind(jti)
    .first<RefreshRow>();

  if (!row || row.token_hash !== hash) return null;

  // Já rotacionado → suspeita de reuso: revoga tudo da family
  if (row.replaced_by || row.revoked_at) {
    await db
      .prepare(
        `UPDATE refresh_tokens SET revoked_at = datetime('now')
         WHERE family_id = ? AND revoked_at IS NULL`
      )
      .bind(row.family_id)
      .run();
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const next = await issueRefreshToken(db, row.user_id, {
    familyId: row.family_id,
    userAgent: opts.userAgent,
    ip: opts.ip,
  });

  await db
    .prepare(
      `UPDATE refresh_tokens SET revoked_at = datetime('now'), replaced_by = ? WHERE jti = ?`
    )
    .bind(next.jti, row.jti)
    .run();

  return { userId: row.user_id, ...next };
}

export async function revokeRefreshToken(db: D1Database, presented: string): Promise<void> {
  const dot = presented.indexOf('.');
  if (dot < 0) return;
  const jti = presented.slice(0, dot);
  await db
    .prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE jti = ? AND revoked_at IS NULL`)
    .bind(jti)
    .run();
}

export async function revokeAllForUser(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(userId)
    .run();
}
