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
import documents from './routes/documents';
import auditLinks from './routes/audit-links';
import maintenance from './routes/maintenance';
import reports from './routes/reports';
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

// Properties CRUD + dashboard
api.route('/properties', properties);

// Nested under /properties/:propertyId
api.route('/properties/:propertyId/rooms',       rooms);
api.route('/properties/:propertyId/inventory',   inventory);
api.route('/properties/:propertyId/services',    services);
api.route('/properties/:propertyId/expenses',    expenses);
api.route('/properties/:propertyId/documents',   documents);
api.route('/properties/:propertyId/maintenance', maintenance);

// Reports: /api/v1/properties/:propertyId/report/...
api.route('/properties/:propertyId/report', reports);

// Audit link creation (nested under property+service)
api.route('/properties/:propertyId/services/:serviceId/audit-link', auditLinks);

// Public audit endpoints (no auth required — handled inside the route)
api.route('/audit', auditLinks);

// ── Cron trigger — expire audit links ────────────────────────────────────────

app.get('/__cron/expire-links', async (c) => {
  // Only allow Cloudflare Cron Triggers (or internal calls in dev)
  const cronSecret = c.req.header('X-Cron-Secret');
  if (c.env.ENVIRONMENT === 'production' && cronSecret !== c.env.JWT_SECRET) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const result = await c.env.DB
    .prepare(
      `UPDATE audit_links SET status = 'expired'
       WHERE status = 'active' AND expires_at < datetime('now')`
    )
    .run();

  return c.json({ expired: result.meta?.changes ?? 0 });
});

// ── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: 'Rota não encontrada', code: 'NOT_FOUND' }, 404)
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Erro interno', code: 'INTERNAL_ERROR' }, 500);
});

export default app;
