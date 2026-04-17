import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { signJwt, verifyJwt, hashPassword, verifyPassword } from '../lib/jwt';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables, User } from '../lib/types';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

// ── POST /auth/register ─────────────────────────────────────────────────────

auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { email, name, password, role, phone } = parsed.data;

  // Check duplicate
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

  const token = await signJwt({ sub: id, email, role }, c.env.JWT_SECRET);

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
      token,
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
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);
  }

  const { email, password } = parsed.data;

  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .bind(email)
    .first<User>();

  if (!user) {
    return err(c, 'Credenciais inválidas', 'INVALID_CREDENTIALS', 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return err(c, 'Credenciais inválidas', 'INVALID_CREDENTIALS', 401);
  }

  // Update last_login
  await c.env.DB
    .prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`)
    .bind(user.id)
    .run();

  const token = await signJwt(
    { sub: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET
  );

  await writeAuditLog(c.env.DB, {
    entityType: 'user',
    entityId: user.id,
    action: 'login',
    actorId: user.id,
    actorIp: c.req.header('CF-Connecting-IP'),
  });

  return ok(c, {
    token,
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

// ── POST /auth/refresh ──────────────────────────────────────────────────────

auth.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return err(c, 'Token não fornecido', 'UNAUTHORIZED', 401);
  }

  const token = authHeader.slice(7);
  // Allow slightly expired tokens (5 min grace)
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET).catch(async () => {
      // Try to decode without strict expiry (manual decode)
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
      c.env.JWT_SECRET
    );

    return ok(c, { token: newToken });
  } catch {
    return err(c, 'Token inválido ou expirado', 'UNAUTHORIZED', 401);
  }
});

// ── GET /auth/me ────────────────────────────────────────────────────────────

auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB
    .prepare(
      `SELECT id, email, name, role, phone, avatar_url, created_at, last_login
       FROM users WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(userId)
    .first<Omit<User, 'password_hash' | 'deleted_at'>>();

  if (!user) return err(c, 'Usuário não encontrado', 'NOT_FOUND', 404);

  return ok(c, { user });
});

export default auth;
