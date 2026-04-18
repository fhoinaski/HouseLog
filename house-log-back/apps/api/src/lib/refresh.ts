// Refresh token rotativo com detecção de reuso.
// - access_token: JWT curto (existente em lib/jwt.ts, TTL ~1h recomendado)
// - refresh_token: string opaca + family_id. Ao rotacionar, marca o antigo como
//   replaced_by. Se o cliente tentar usar um refresh já rotacionado, revogamos
//   toda a family (possível vazamento).
//
// Armazenamos apenas o HASH (SHA-256) do token — nunca o valor cru.

import { nanoid } from 'nanoid';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { refreshTokens } from '../db/schema';

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
  const drizzle = getDb(db);
  const jti = nanoid(24);
  const raw = nanoid(48);
  const token = `${jti}.${raw}`;
  const familyId = opts.familyId ?? nanoid(16);
  const ttlDays = opts.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();
  const hash = await sha256Hex(raw);

  await drizzle.insert(refreshTokens).values({
    jti,
    userId,
    familyId,
    tokenHash: hash,
    expiresAt,
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });

  return { token, jti, familyId, expiresAt };
}

// Valida e rotaciona. Retorna novo refresh_token ou null em caso de inválido.
// Se detectar reuso (token já replaced), revoga TODA a family.
export async function rotateRefreshToken(
  db: D1Database,
  presented: string,
  opts: { userAgent?: string | null; ip?: string | null } = {}
): Promise<{ userId: string; token: string; jti: string; familyId: string; expiresAt: string } | null> {
  const drizzle = getDb(db);
  const dot = presented.indexOf('.');
  if (dot < 0) return null;
  const jti = presented.slice(0, dot);
  const raw = presented.slice(dot + 1);
  const hash = await sha256Hex(raw);

  const rows = await drizzle
    .select({
      jti: refreshTokens.jti,
      user_id: refreshTokens.userId,
      family_id: refreshTokens.familyId,
      token_hash: refreshTokens.tokenHash,
      issued_at: refreshTokens.issuedAt,
      expires_at: refreshTokens.expiresAt,
      revoked_at: refreshTokens.revokedAt,
      replaced_by: refreshTokens.replacedBy,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.jti, jti))
    .limit(1);

  const row = rows[0] as RefreshRow | undefined;

  if (!row || row.token_hash !== hash) return null;

  // Já rotacionado → suspeita de reuso: revoga tudo da family
  if (row.replaced_by || row.revoked_at) {
    await drizzle
      .update(refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(refreshTokens.familyId, row.family_id), isNull(refreshTokens.revokedAt)));
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const next = await issueRefreshToken(db, row.user_id, {
    familyId: row.family_id,
    userAgent: opts.userAgent,
    ip: opts.ip,
  });

  await drizzle
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString(), replacedBy: next.jti })
    .where(eq(refreshTokens.jti, row.jti));

  return { userId: row.user_id, ...next };
}

export async function revokeRefreshToken(db: D1Database, presented: string): Promise<void> {
  const drizzle = getDb(db);
  const dot = presented.indexOf('.');
  if (dot < 0) return;
  const jti = presented.slice(0, dot);
  await drizzle
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(refreshTokens.jti, jti), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllForUser(db: D1Database, userId: string): Promise<void> {
  const drizzle = getDb(db);
  await drizzle
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}
