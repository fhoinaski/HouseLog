import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimitMiddleware } from './middleware/rateLimit';
import auth from './routes/auth';
import properties from './routes/properties';
import rooms from './routes/rooms';
import inventory from './routes/inventory';
import services from './routes/services';
import expenses from './routes/expenses';
import type { Bindings, Variables } from './lib/types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── Global middleware ────────────────────────────────────────────────────────

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN ?? '*',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.use('*', logger());
app.use('/api/*', rateLimitMiddleware);

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/', (c) => c.json({ service: 'HouseLog API', version: '1.0.0', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes ───────────────────────────────────────────────────────────────────

const api = app.basePath('/api/v1');

// Auth
api.route('/auth', auth);

// Properties (and nested resources)
api.route('/properties', properties);

// Nested rooms: /api/v1/properties/:propertyId/rooms
api.route('/properties/:propertyId/rooms', rooms);

// Nested inventory: /api/v1/properties/:propertyId/inventory
api.route('/properties/:propertyId/inventory', inventory);

// Nested services: /api/v1/properties/:propertyId/services
api.route('/properties/:propertyId/services', services);

// Nested expenses: /api/v1/properties/:propertyId/expenses
api.route('/properties/:propertyId/expenses', expenses);

// ── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: 'Rota não encontrada', code: 'NOT_FOUND' }, 404)
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Erro interno', code: 'INTERNAL_ERROR' }, 500);
});

export default app;
