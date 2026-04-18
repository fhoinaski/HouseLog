import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { signJwt, verifyJwt, hashPassword, verifyPassword } from '../lib/jwt';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import { mfaChallenges, userMfa, users } from '../db/schema';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} from '../lib/refresh';
import { generateSecret, otpauthUri, totpVerify, generateBackupCodes } from '../lib/totp';
import { normalizeProviderCategories } from '../lib/provider-categories';
import type { Bindings, Variables, User } from '../lib/types';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const ACCESS_TOKEN_TTL = 60 * 60; // 1h

const educationEntrySchema = z.object({
  institution: z.string().min(2).max(160),
  title: z.string().min(2).max(160),
  type: z.enum(['college', 'technical', 'course', 'certification', 'other']),
  status: z.enum(['in_progress', 'completed']),
  certificationUrl: z.string().url().optional(),
});

const portfolioCaseSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(1500).optional(),
  beforeImageUrl: z.string().url().optional(),
  afterImageUrl: z.string().url().optional(),
});

// ── Schemas ────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'owner', 'provider']).default('owner'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  service_area: z.string().max(200).optional(),
  pix_key: z.string().max(140).optional(),
  pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).optional(),
  provider_bio: z.string().max(2000).optional(),
  provider_courses: z.array(z.string().min(2).max(120)).max(50).optional(),
  provider_specializations: z.array(z.string().min(2).max(120)).max(50).optional(),
  provider_portfolio: z.array(z.string().min(2).max(200)).max(100).optional(),
  provider_education: z.array(educationEntrySchema).max(50).optional(),
  provider_portfolio_cases: z.array(portfolioCaseSchema).max(100).optional(),
  provider_categories: z.array(z.string().min(2)).max(40).optional(),
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
  whatsapp: z.string().optional(),
  service_area: z.string().max(200).optional(),
  pix_key: z.string().max(140).optional(),
  pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).optional(),
  provider_bio: z.string().max(2000).optional(),
  provider_courses: z.array(z.string().min(2).max(120)).max(50).optional(),
  provider_specializations: z.array(z.string().min(2).max(120)).max(50).optional(),
  provider_portfolio: z.array(z.string().min(2).max(200)).max(100).optional(),
  provider_education: z.array(educationEntrySchema).max(50).optional(),
  provider_portfolio_cases: z.array(portfolioCaseSchema).max(100).optional(),
  provider_categories: z.array(z.string().min(2)).max(40).optional(),
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
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { email, name, password, role, phone } = parsed.data;
  const providerCategories = role === 'provider'
    ? normalizeProviderCategories(parsed.data.provider_categories ?? [])
    : [];
  const providerCourses = role === 'provider' ? (parsed.data.provider_courses ?? []) : [];
  const providerSpecializations = role === 'provider' ? (parsed.data.provider_specializations ?? []) : [];
  const providerPortfolio = role === 'provider' ? (parsed.data.provider_portfolio ?? []) : [];
  const providerEducation = role === 'provider' ? (parsed.data.provider_education ?? []) : [];
  const providerPortfolioCases = role === 'provider' ? (parsed.data.provider_portfolio_cases ?? []) : [];

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (existing) {
    return err(c, 'Email já cadastrado', 'EMAIL_TAKEN', 409);
  }

  const id = nanoid();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    email,
    name,
    role,
    providerCategories,
    passwordHash,
    phone: phone ?? null,
    whatsapp: parsed.data.whatsapp ?? null,
    serviceArea: parsed.data.service_area ?? null,
    pixKey: parsed.data.pix_key ?? null,
    pixKeyType: parsed.data.pix_key_type ?? null,
    providerBio: parsed.data.provider_bio ?? null,
    providerCourses,
    providerSpecializations,
    providerPortfolio,
    providerEducation,
    providerPortfolioCases,
  });

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
      user: {
        id,
        email,
        name,
        role,
        phone: phone ?? null,
        whatsapp: parsed.data.whatsapp ?? null,
        service_area: parsed.data.service_area ?? null,
        pix_key: parsed.data.pix_key ?? null,
        pix_key_type: parsed.data.pix_key_type ?? null,
        provider_bio: parsed.data.provider_bio ?? null,
        provider_courses: providerCourses,
        provider_specializations: providerSpecializations,
        provider_portfolio: providerPortfolio,
        provider_education: providerEducation,
        provider_portfolio_cases: providerPortfolioCases,
        provider_categories: providerCategories,
        created_at: new Date().toISOString(),
      },
    },
    201
  );
});

// ── POST /auth/login ────────────────────────────────────────────────────────

auth.post('/login', async (c) => {
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const { email, password } = parsed.data;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      provider_categories: users.providerCategories,
      password_hash: users.passwordHash,
      phone: users.phone,
      whatsapp: users.whatsapp,
      service_area: users.serviceArea,
      pix_key: users.pixKey,
      pix_key_type: users.pixKeyType,
      provider_bio: users.providerBio,
      provider_courses: users.providerCourses,
      provider_specializations: users.providerSpecializations,
      provider_portfolio: users.providerPortfolio,
      provider_education: users.providerEducation,
      provider_portfolio_cases: users.providerPortfolioCases,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1) as User[];

  if (!user) return err(c, 'Credenciais inválidas', 'INVALID_CREDENTIALS', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return err(c, 'Credenciais inválidas', 'INVALID_CREDENTIALS', 401);

  // Migra legado SHA-256 → PBKDF2 na primeira autenticação bem-sucedida
  const isLegacy = !user.password_hash.startsWith('pbkdf2:');
  const newHash = isLegacy ? await hashPassword(password) : user.password_hash;
  const updateFields = isLegacy
    ? `password_hash = ?, last_login = datetime('now')`
    : `last_login = datetime('now')`;
  await db
    .update(users)
    .set(
      isLegacy
        ? { passwordHash: newHash, lastLogin: new Date().toISOString() }
        : { lastLogin: new Date().toISOString() }
    )
    .where(eq(users.id, user.id));

  // MFA habilitado? Emite challenge em vez do token final.
  const [mfa] = await db
    .select({ user_id: userMfa.userId })
    .from(userMfa)
    .where(and(eq(userMfa.userId, user.id), sql`${userMfa.enabledAt} IS NOT NULL`))
    .limit(1) as Array<{ user_id: string }>;

  if (mfa) {
    const challengeToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await db.insert(mfaChallenges).values({
      id: challengeToken,
      userId: user.id,
      expiresAt,
    });
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
      provider_categories: user.provider_categories ?? [],
      phone: user.phone,
      whatsapp: user.whatsapp,
      service_area: user.service_area,
      pix_key: user.pix_key,
      pix_key_type: user.pix_key_type,
      provider_bio: user.provider_bio,
      provider_courses: user.provider_courses ?? [],
      provider_specializations: user.provider_specializations ?? [],
      provider_portfolio: user.provider_portfolio ?? [],
      provider_education: user.provider_education ?? [],
      provider_portfolio_cases: user.provider_portfolio_cases ?? [],
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

  const db = getDb(c.env.DB);
  const [challenge] = await db
    .select({
      id: mfaChallenges.id,
      user_id: mfaChallenges.userId,
      expires_at: mfaChallenges.expiresAt,
      consumed_at: mfaChallenges.consumedAt,
    })
    .from(mfaChallenges)
    .where(eq(mfaChallenges.id, challenge_token))
    .limit(1) as Array<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>;

  if (!challenge || challenge.consumed_at) {
    return err(c, 'Desafio inválido', 'INVALID_CHALLENGE', 401);
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return err(c, 'Desafio expirado', 'CHALLENGE_EXPIRED', 401);
  }

  const [mfa] = await db
    .select({ secret: userMfa.secret, backup_codes: userMfa.backupCodes })
    .from(userMfa)
    .where(eq(userMfa.userId, challenge.user_id))
    .limit(1) as Array<{ secret: string; backup_codes: string[] }>;
  if (!mfa) return err(c, 'MFA não configurado', 'MFA_MISSING', 400);

  let passed = await totpVerify(mfa.secret, code);
  let usedBackup: string | null = null;

  if (!passed) {
    const codes = mfa.backup_codes;
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
    ? mfa.backup_codes.filter((h) => h !== usedBackup)
    : null;

  await db
    .update(mfaChallenges)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(mfaChallenges.id, challenge.id));
  await db
    .update(userMfa)
    .set(
      remainingCodes
        ? { lastUsedAt: new Date().toISOString(), backupCodes: remainingCodes }
        : { lastUsedAt: new Date().toISOString() }
    )
    .where(eq(userMfa.userId, challenge.user_id));

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      provider_categories: users.providerCategories,
      phone: users.phone,
      whatsapp: users.whatsapp,
      service_area: users.serviceArea,
      pix_key: users.pixKey,
      pix_key_type: users.pixKeyType,
      provider_bio: users.providerBio,
      provider_courses: users.providerCourses,
      provider_specializations: users.providerSpecializations,
      provider_portfolio: users.providerPortfolio,
      provider_education: users.providerEducation,
      provider_portfolio_cases: users.providerPortfolioCases,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(and(eq(users.id, challenge.user_id), isNull(users.deletedAt)))
    .limit(1) as Array<Pick<User, 'id' | 'email' | 'name' | 'role' | 'provider_categories' | 'phone' | 'whatsapp' | 'service_area' | 'pix_key' | 'pix_key_type' | 'provider_bio' | 'provider_courses' | 'provider_specializations' | 'provider_portfolio' | 'provider_education' | 'provider_portfolio_cases' | 'avatar_url'>>;
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

    const db = getDb(c.env.DB);
    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.id, rotated.userId), isNull(users.deletedAt)))
      .limit(1) as Array<Pick<User, 'id' | 'email' | 'role'>>;
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

    const db = getDb(c.env.DB);
    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
      .limit(1) as Array<Pick<User, 'id' | 'email' | 'role'>>;
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
  const db = getDb(c.env.DB);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      provider_categories: users.providerCategories,
      phone: users.phone,
      whatsapp: users.whatsapp,
      service_area: users.serviceArea,
      pix_key: users.pixKey,
      pix_key_type: users.pixKeyType,
      provider_bio: users.providerBio,
      provider_courses: users.providerCourses,
      provider_specializations: users.providerSpecializations,
      provider_portfolio: users.providerPortfolio,
      provider_education: users.providerEducation,
      provider_portfolio_cases: users.providerPortfolioCases,
      avatar_url: users.avatarUrl,
      created_at: users.createdAt,
      last_login: users.lastLogin,
      mfa_enabled: sql<number>`CASE WHEN ${userMfa.enabledAt} IS NOT NULL THEN 1 ELSE 0 END`,
    })
    .from(users)
    .leftJoin(userMfa, eq(userMfa.userId, users.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1) as Array<Omit<User, 'password_hash' | 'deleted_at'> & { mfa_enabled: number }>;

  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  return ok(c, { user: { ...user, mfa_enabled: Boolean(user.mfa_enabled) } });
});

// ── MFA: setup / verify / disable ───────────────────────────────────────────

auth.post('/mfa/setup', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = getDb(c.env.DB);

  const [existing] = await db
    .select({ enabled_at: userMfa.enabledAt })
    .from(userMfa)
    .where(eq(userMfa.userId, userId))
    .limit(1) as Array<{ enabled_at: string | null }>;
  if (existing?.enabled_at) {
    return err(c, 'MFA já está habilitado', 'MFA_ALREADY_ENABLED', 409);
  }

  const secret = generateSecret();
  const uri = otpauthUri({ accountName: userEmail, issuer: 'HouseLog', secret });

  if (existing) {
    await db
      .update(userMfa)
      .set({ secret, enabledAt: null })
      .where(eq(userMfa.userId, userId));
  } else {
    await db.insert(userMfa).values({ userId, secret });
  }

  return ok(c, { secret, otpauth_uri: uri });
});

auth.post('/mfa/verify', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => null);
  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const [row] = await db
    .select({ secret: userMfa.secret, enabled_at: userMfa.enabledAt })
    .from(userMfa)
    .where(eq(userMfa.userId, userId))
    .limit(1) as Array<{ secret: string; enabled_at: string | null }>;
  if (!row) return err(c, 'MFA não iniciado', 'MFA_NOT_INITIATED', 400);
  if (row.enabled_at) return err(c, 'MFA já habilitado', 'MFA_ALREADY_ENABLED', 409);

  const passed = await totpVerify(row.secret, parsed.data.code);
  if (!passed) return err(c, 'Código inválido', 'INVALID_MFA_CODE', 401);

  // Gera backup codes e armazena como hash PBKDF2
  const rawCodes = generateBackupCodes(10);
  const hashedCodes = await Promise.all(rawCodes.map((c0) => hashPassword(c0)));

  await db
    .update(userMfa)
    .set({ enabledAt: new Date().toISOString(), backupCodes: hashedCodes })
    .where(eq(userMfa.userId, userId));

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
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ password: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return err(c, 'Senha obrigatória', 'VALIDATION_ERROR', 422);

  const [user] = await db
    .select({ password_hash: users.passwordHash })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1) as Array<Pick<User, 'password_hash'>>;
  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) return err(c, 'Senha incorreta', 'INVALID_PASSWORD', 401);

  await db.delete(userMfa).where(eq(userMfa.userId, userId));

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
  const db = getDb(c.env.DB);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db
    .select({ id: users.id, password_hash: users.passwordHash })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1) as Array<Pick<User, 'id' | 'password_hash'>>;

  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) return err(c, 'Senha atual incorreta', 'INVALID_PASSWORD', 401);

  const newHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

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
  const db = getDb(c.env.DB);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { name, phone } = parsed.data;
  const parsedProviderCategories = parsed.data.provider_categories !== undefined
    ? normalizeProviderCategories(parsed.data.provider_categories)
    : undefined;
  const parsedCourses = parsed.data.provider_courses;
  const parsedSpecializations = parsed.data.provider_specializations;
  const parsedPortfolio = parsed.data.provider_portfolio;
  const parsedEducation = parsed.data.provider_education;
  const parsedPortfolioCases = parsed.data.provider_portfolio_cases;

  if (
    name === undefined &&
    phone === undefined &&
    parsed.data.whatsapp === undefined &&
    parsed.data.service_area === undefined &&
    parsed.data.pix_key === undefined &&
    parsed.data.pix_key_type === undefined &&
    parsed.data.provider_bio === undefined &&
    parsedCourses === undefined &&
    parsedSpecializations === undefined &&
    parsedPortfolio === undefined &&
    parsedEducation === undefined &&
    parsedPortfolioCases === undefined &&
    parsedProviderCategories === undefined
  ) {
    return err(c, 'Nenhum campo para atualizar', 'EMPTY_BODY', 400);
  }

  const [current] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      provider_categories: users.providerCategories,
      whatsapp: users.whatsapp,
      service_area: users.serviceArea,
      pix_key: users.pixKey,
      pix_key_type: users.pixKeyType,
      provider_bio: users.providerBio,
      provider_courses: users.providerCourses,
      provider_specializations: users.providerSpecializations,
      provider_portfolio: users.providerPortfolio,
      provider_education: users.providerEducation,
      provider_portfolio_cases: users.providerPortfolioCases,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1) as Array<Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'provider_categories' | 'whatsapp' | 'service_area' | 'pix_key' | 'pix_key_type' | 'provider_bio' | 'provider_courses' | 'provider_specializations' | 'provider_portfolio' | 'provider_education' | 'provider_portfolio_cases'>>;

  if (!current) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  if (parsedProviderCategories !== undefined && current.role !== 'provider' && current.role !== 'admin') {
    return err(c, 'Apenas prestadores podem definir categorias de serviço', 'FORBIDDEN', 403);
  }

  const updatedName = name ?? current.name;
  const updatedPhone = phone ?? current.phone;
  const updatedProviderCategories = parsedProviderCategories ?? (current.provider_categories ?? []);
  const updatedWhatsapp = parsed.data.whatsapp ?? current.whatsapp;
  const updatedServiceArea = parsed.data.service_area ?? current.service_area;
  const updatedPixKey = parsed.data.pix_key ?? current.pix_key;
  const updatedPixKeyType = parsed.data.pix_key_type ?? current.pix_key_type;
  const updatedProviderBio = parsed.data.provider_bio ?? current.provider_bio;
  const updatedProviderCourses = parsedCourses ?? (current.provider_courses ?? []);
  const updatedProviderSpecializations = parsedSpecializations ?? (current.provider_specializations ?? []);
  const updatedProviderPortfolio = parsedPortfolio ?? (current.provider_portfolio ?? []);
  const updatedProviderEducation = parsedEducation ?? (current.provider_education ?? []);
  const updatedProviderPortfolioCases = parsedPortfolioCases ?? (current.provider_portfolio_cases ?? []);

  await db
    .update(users)
    .set({
      name: updatedName,
      phone: updatedPhone ?? null,
      whatsapp: updatedWhatsapp ?? null,
      serviceArea: updatedServiceArea ?? null,
      pixKey: updatedPixKey ?? null,
      pixKeyType: updatedPixKeyType ?? null,
      providerBio: updatedProviderBio ?? null,
      providerCourses: updatedProviderCourses,
      providerSpecializations: updatedProviderSpecializations,
      providerPortfolio: updatedProviderPortfolio,
      providerEducation: updatedProviderEducation,
      providerPortfolioCases: updatedProviderPortfolioCases,
      providerCategories: updatedProviderCategories,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: userId,
    action: 'UPDATE',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: {
      name: current.name,
      phone: current.phone,
      whatsapp: current.whatsapp,
      service_area: current.service_area,
      pix_key: current.pix_key,
      pix_key_type: current.pix_key_type,
      provider_bio: current.provider_bio,
      provider_courses: current.provider_courses ?? [],
      provider_specializations: current.provider_specializations ?? [],
      provider_portfolio: current.provider_portfolio ?? [],
      provider_education: current.provider_education ?? [],
      provider_portfolio_cases: current.provider_portfolio_cases ?? [],
      provider_categories: current.provider_categories ?? [],
    },
    newData: {
      name: updatedName,
      phone: updatedPhone,
      whatsapp: updatedWhatsapp,
      service_area: updatedServiceArea,
      pix_key: updatedPixKey,
      pix_key_type: updatedPixKeyType,
      provider_bio: updatedProviderBio,
      provider_courses: updatedProviderCourses,
      provider_specializations: updatedProviderSpecializations,
      provider_portfolio: updatedProviderPortfolio,
      provider_education: updatedProviderEducation,
      provider_portfolio_cases: updatedProviderPortfolioCases,
      provider_categories: updatedProviderCategories,
    },
  });

  return ok(c, {
    user: {
      id: current.id,
      name: updatedName,
      email: current.email,
      phone: updatedPhone ?? null,
      whatsapp: updatedWhatsapp ?? null,
      service_area: updatedServiceArea ?? null,
      pix_key: updatedPixKey ?? null,
      pix_key_type: updatedPixKeyType ?? null,
      provider_bio: updatedProviderBio ?? null,
      provider_courses: updatedProviderCourses,
      provider_specializations: updatedProviderSpecializations,
      provider_portfolio: updatedProviderPortfolio,
      provider_education: updatedProviderEducation,
      provider_portfolio_cases: updatedProviderPortfolioCases,
      role: current.role,
      provider_categories: updatedProviderCategories,
    },
  });
});

export default auth;
