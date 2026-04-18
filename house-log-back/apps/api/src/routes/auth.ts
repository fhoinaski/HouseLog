import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { signJwt, verifyJwt, hashPassword, verifyPassword } from '../lib/jwt';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} from '../lib/refresh';
import { generateSecret, otpauthUri, totpVerify, generateBackupCodes } from '../lib/totp';
import type { Bindings, Variables, User } from '../lib/types';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const ACCESS_TOKEN_TTL = 60 * 60; // 1h

// ── Schemas ────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'owner', 'provider']).default('owner'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Nova senha deve ter ao menos 8 caracteres'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').optional(),
  phone: z.string().optional(),
});

const mfaVerifySchema = z.object({ code: z.string().min(6).max(8) });
const mfaChallengeSchema = z.object({
  challenge_token: z.string().min(1),
  code: z.string().min(6).max(10),
});
const refreshBodySchema = z.object({ refresh_token: z.string().min(10) });

// ── helpers ────────────────────────────────────────────────────────────────

async function issueTokenPair(
  c: {
    env: Bindings;
    req: { header: (n: string) => string | undefined };
  },
  user: Pick<User, 'id' | 'email' | 'role'>
) {
  const access = await signJwt(
    { sub: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET,
    ACCESS_TOKEN_TTL
  );
  const ttlDays = Number(c.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
  const refresh = await issueRefreshToken(c.env.DB, user.id, {
    ttlDays,
    userAgent: c.req.header('User-Agent') ?? null,
    ip: c.req.header('CF-Connecting-IP') ?? null,
  });
  return { access, refresh };
}

// ── POST /auth/register ─────────────────────────────────────────────────────

auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { email, name, password, role, phone } = parsed.data;

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL')
    .bind(email)
    .first();

  if (existing) {
    return err(c, 'Email já cadastrado', 'EMAIL_TAKEN', 409);
  }

  const id = nanoid();
  const password_hash = await hashPassword(password);

  await c.env.DB
    .prepare(
      `INSERT INTO users (id, email, name, role, password_hash, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(id, email, name, role, password_hash, phone ?? null)
    .run();

  const pair = await issueTokenPair(c, { id, email, role });

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: id,
    action: 'register',
    actorId: id,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { id, email, name, role },
  });

  return ok(
    c,
    {
      token: pair.access, // compat com clientes antigos
      access_token: pair.access,
      refresh_token: pair.refresh.token,
      expires_in: ACCESS_TOKEN_TTL,
      user: { id, email, name, role, phone: phone ?? null, created_at: new Date().toISOString() },
    },
    201
  );
});

// ── POST /auth/login ────────────────────────────────────────────────────────

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const { email, password } = parsed.data;

  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .bind(email)
    .first<User>();

  if (!user) return err(c, 'Credenciais inválidas', 'INVALID_CREDENTIALS', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return err(c, 'Credenciais inválidas', 'INVALID_CREDENTIALS', 401);

  // Migra legado SHA-256 → PBKDF2 na primeira autenticação bem-sucedida
  const isLegacy = !user.password_hash.startsWith('pbkdf2:');
  const newHash = isLegacy ? await hashPassword(password) : user.password_hash;
  const updateFields = isLegacy
    ? `password_hash = ?, last_login = datetime('now')`
    : `last_login = datetime('now')`;
  await c.env.DB
    .prepare(`UPDATE users SET ${updateFields} WHERE id = ?`)
    .bind(...(isLegacy ? [newHash, user.id] : [user.id]))
    .run();

  // MFA habilitado? Emite challenge em vez do token final.
  const mfa = await c.env.DB
    .prepare(`SELECT user_id FROM user_mfa WHERE user_id = ? AND enabled_at IS NOT NULL`)
    .bind(user.id)
    .first<{ user_id: string }>();

  if (mfa) {
    const challengeToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await c.env.DB
      .prepare(`INSERT INTO mfa_challenges (id, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind(challengeToken, user.id, expiresAt)
      .run();
    return ok(c, { mfa_required: true, challenge_token: challengeToken });
  }

  const pair = await issueTokenPair(c, user);

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: user.id,
    action: 'login',
    actorId: user.id,
    actorIp: c.req.header('CF-Connecting-IP'),
  });

  return ok(c, {
    token: pair.access,
    access_token: pair.access,
    refresh_token: pair.refresh.token,
    expires_in: ACCESS_TOKEN_TTL,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar_url: user.avatar_url,
    },
  });
});

// ── POST /auth/mfa/challenge ────────────────────────────────────────────────
// Segunda etapa do login quando MFA está habilitado.
auth.post('/mfa/challenge', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = mfaChallengeSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const { challenge_token, code } = parsed.data;

  const challenge = await c.env.DB
    .prepare(
      `SELECT id, user_id, expires_at, consumed_at FROM mfa_challenges WHERE id = ?`
    )
    .bind(challenge_token)
    .first<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>();

  if (!challenge || challenge.consumed_at) {
    return err(c, 'Desafio inválido', 'INVALID_CHALLENGE', 401);
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return err(c, 'Desafio expirado', 'CHALLENGE_EXPIRED', 401);
  }

  const mfa = await c.env.DB
    .prepare(`SELECT secret, backup_codes FROM user_mfa WHERE user_id = ?`)
    .bind(challenge.user_id)
    .first<{ secret: string; backup_codes: string }>();
  if (!mfa) return err(c, 'MFA não configurado', 'MFA_MISSING', 400);

  let passed = await totpVerify(mfa.secret, code);
  let usedBackup: string | null = null;

  if (!passed) {
    const codes = JSON.parse(mfa.backup_codes) as string[];
    const normalized = code.replace(/\s+/g, '').toUpperCase();
    for (const hash of codes) {
      const candidate = await hashPassword(normalized, hash.split(':')[1]);
      if (candidate === hash) {
        passed = true;
        usedBackup = hash;
        break;
      }
    }
  }

  if (!passed) return err(c, 'Código inválido', 'INVALID_MFA_CODE', 401);

  const remainingCodes = usedBackup
    ? (JSON.parse(mfa.backup_codes) as string[]).filter((h) => h !== usedBackup)
    : null;

  await c.env.DB
    .prepare(`UPDATE mfa_challenges SET consumed_at = datetime('now') WHERE id = ?`)
    .bind(challenge.id)
    .run();
  await c.env.DB
    .prepare(
      remainingCodes
        ? `UPDATE user_mfa SET last_used_at = datetime('now'), backup_codes = ? WHERE user_id = ?`
        : `UPDATE user_mfa SET last_used_at = datetime('now') WHERE user_id = ?`
    )
    .bind(...(remainingCodes ? [JSON.stringify(remainingCodes), challenge.user_id] : [challenge.user_id]))
    .run();

  const user = await c.env.DB
    .prepare(
      `SELECT id, email, name, role, phone, avatar_url FROM users WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(challenge.user_id)
    .first<Pick<User, 'id' | 'email' | 'name' | 'role' | 'phone' | 'avatar_url'>>();
  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  const pair = await issueTokenPair(c, user);

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: user.id,
    action: 'login_mfa',
    actorId: user.id,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { backup_used: Boolean(usedBackup) },
  });

  return ok(c, {
    token: pair.access,
    access_token: pair.access,
    refresh_token: pair.refresh.token,
    expires_in: ACCESS_TOKEN_TTL,
    user,
  });
});

// ── POST /auth/refresh ──────────────────────────────────────────────────────
// Aceita { refresh_token } no body (preferido). Mantém compat com o fluxo antigo
// (Authorization: Bearer <access>) apenas emitindo novo access sem rotacionar.
auth.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = refreshBodySchema.safeParse(body);

  if (parsed.success) {
    const rotated = await rotateRefreshToken(c.env.DB, parsed.data.refresh_token, {
      userAgent: c.req.header('User-Agent') ?? null,
      ip: c.req.header('CF-Connecting-IP') ?? null,
    });
    if (!rotated) return err(c, 'Refresh token inválido', 'UNAUTHORIZED', 401);

    const user = await c.env.DB
      .prepare(`SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL`)
      .bind(rotated.userId)
      .first<Pick<User, 'id' | 'email' | 'role'>>();
    if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

    const access = await signJwt(
      { sub: user.id, email: user.email, role: user.role },
      c.env.JWT_SECRET,
      ACCESS_TOKEN_TTL
    );
    return ok(c, {
      token: access,
      access_token: access,
      refresh_token: rotated.token,
      expires_in: ACCESS_TOKEN_TTL,
    });
  }

  // Fallback legado: Authorization: Bearer <access expirando>
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return err(c, 'Token não fornecido', 'UNAUTHORIZED', 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET).catch(async () => {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('invalid');
      const decoded = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
      const gracePeriod = 5 * 60;
      if (decoded.exp + gracePeriod < Math.floor(Date.now() / 1000)) throw new Error('expired');
      return decoded;
    });

    const user = await c.env.DB
      .prepare('SELECT id, email, role FROM users WHERE id = ? AND deleted_at IS NULL')
      .bind(payload.sub)
      .first<Pick<User, 'id' | 'email' | 'role'>>();
    if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

    const newToken = await signJwt(
      { sub: user.id, email: user.email, role: user.role },
      c.env.JWT_SECRET,
      ACCESS_TOKEN_TTL
    );
    return ok(c, { token: newToken, access_token: newToken, expires_in: ACCESS_TOKEN_TTL });
  } catch {
    return err(c, 'Token inválido ou expirado', 'UNAUTHORIZED', 401);
  }
});

// ── POST /auth/logout ──────────────────────────────────────────────────────
// Revoga refresh_token específico (se enviado) ou todos do usuário autenticado.
auth.post('/logout', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  if (typeof body?.refresh_token === 'string') {
    await revokeRefreshToken(c.env.DB, body.refresh_token);
  } else {
    await revokeAllForUser(c.env.DB, userId);
  }
  return ok(c, { ok: true });
});

// ── GET /auth/me ────────────────────────────────────────────────────────────

auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.phone, u.avatar_url, u.created_at, u.last_login,
              CASE WHEN m.enabled_at IS NOT NULL THEN 1 ELSE 0 END AS mfa_enabled
       FROM users u
       LEFT JOIN user_mfa m ON m.user_id = u.id
       WHERE u.id = ? AND u.deleted_at IS NULL`
    )
    .bind(userId)
    .first<Omit<User, 'password_hash' | 'deleted_at'> & { mfa_enabled: number }>();

  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  return ok(c, { user: { ...user, mfa_enabled: Boolean(user.mfa_enabled) } });
});

// ── MFA: setup / verify / disable ───────────────────────────────────────────

auth.post('/mfa/setup', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');

  const existing = await c.env.DB
    .prepare(`SELECT enabled_at FROM user_mfa WHERE user_id = ?`)
    .bind(userId)
    .first<{ enabled_at: string | null }>();
  if (existing?.enabled_at) {
    return err(c, 'MFA já está habilitado', 'MFA_ALREADY_ENABLED', 409);
  }

  const secret = generateSecret();
  const uri = otpauthUri({ accountName: userEmail, issuer: 'HouseLog', secret });

  if (existing) {
    await c.env.DB
      .prepare(`UPDATE user_mfa SET secret = ?, enabled_at = NULL WHERE user_id = ?`)
      .bind(secret, userId)
      .run();
  } else {
    await c.env.DB
      .prepare(`INSERT INTO user_mfa (user_id, secret) VALUES (?, ?)`)
      .bind(userId, secret)
      .run();
  }

  return ok(c, { secret, otpauth_uri: uri });
});

auth.post('/mfa/verify', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const row = await c.env.DB
    .prepare(`SELECT secret, enabled_at FROM user_mfa WHERE user_id = ?`)
    .bind(userId)
    .first<{ secret: string; enabled_at: string | null }>();
  if (!row) return err(c, 'MFA não iniciado', 'MFA_NOT_INITIATED', 400);
  if (row.enabled_at) return err(c, 'MFA já habilitado', 'MFA_ALREADY_ENABLED', 409);

  const passed = await totpVerify(row.secret, parsed.data.code);
  if (!passed) return err(c, 'Código inválido', 'INVALID_MFA_CODE', 401);

  // Gera backup codes e armazena como hash PBKDF2
  const rawCodes = generateBackupCodes(10);
  const hashedCodes = await Promise.all(rawCodes.map((c0) => hashPassword(c0)));

  await c.env.DB
    .prepare(
      `UPDATE user_mfa SET enabled_at = datetime('now'), backup_codes = ? WHERE user_id = ?`
    )
    .bind(JSON.stringify(hashedCodes), userId)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: userId,
    action: 'mfa_enable',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
  });

  return ok(c, { enabled: true, backup_codes: rawCodes });
});

auth.post('/mfa/disable', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ password: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return err(c, 'Senha obrigatória', 'VALIDATION_ERROR', 422);

  const user = await c.env.DB
    .prepare(`SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<Pick<User, 'password_hash'>>();
  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) return err(c, 'Senha incorreta', 'INVALID_PASSWORD', 401);

  await c.env.DB.prepare(`DELETE FROM user_mfa WHERE user_id = ?`).bind(userId).run();

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: userId,
    action: 'mfa_disable',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
  });

  return ok(c, { enabled: false });
});

// ── PUT /auth/password ──────────────────────────────────────────────────────

auth.put('/password', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await c.env.DB
    .prepare('SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(userId)
    .first<Pick<User, 'id' | 'password_hash'>>();

  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) return err(c, 'Senha atual incorreta', 'INVALID_PASSWORD', 401);

  const newHash = await hashPassword(newPassword);

  await c.env.DB
    .prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(newHash, userId)
    .run();

  // Revoga todos os refresh tokens: força re-login em todos os devices
  await revokeAllForUser(c.env.DB, userId);

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: userId,
    action: 'PASSWORD_CHANGE',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
  });

  return ok(c, { message: 'Senha alterada com sucesso' });
});

// ── PUT /auth/profile ───────────────────────────────────────────────────────

auth.put('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { name, phone } = parsed.data;
  if (name === undefined && phone === undefined) {
    return err(c, 'Nenhum campo para atualizar', 'EMPTY_BODY', 400);
  }

  const current = await c.env.DB
    .prepare('SELECT id, name, email, phone, role FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(userId)
    .first<Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role'>>();

  if (!current) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  const updatedName = name ?? current.name;
  const updatedPhone = phone ?? current.phone;

  await c.env.DB
    .prepare(`UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(updatedName, updatedPhone ?? null, userId)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: userId,
    action: 'UPDATE',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: { name: current.name, phone: current.phone },
    newData: { name: updatedName, phone: updatedPhone },
  });

  return ok(c, {
    user: {
      id: current.id,
      name: updatedName,
      email: current.email,
      phone: updatedPhone ?? null,
      role: current.role,
    },
  });
});

export default auth;
