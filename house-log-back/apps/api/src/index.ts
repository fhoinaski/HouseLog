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
import maintenance, { autoCreateOverdueOS, sendMaintenanceDueEmails } from './routes/maintenance';
import reports from './routes/reports';
import bids from './routes/bids';
import provider from './routes/provider';
import search from './routes/search';
import type { Bindings, Variables, QueueMessage } from './lib/types';

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

// Bids (nested under property+service)
api.route('/properties/:propertyId/services/:serviceId/bids', bids);

// Provider portal
api.route('/provider', provider);

// Audit link creation (nested under property+service)
api.route('/properties/:propertyId/services/:serviceId/audit-link', auditLinks);

// Public audit endpoints (no auth required — handled inside the route)
api.route('/audit', auditLinks);

// Full-text search (services, documents/OCR, inventory, maintenance)
api.route('/search', search);

// ── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: 'Rota não encontrada', code: 'NOT_FOUND' }, 404)
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Erro interno', code: 'INTERNAL_ERROR' }, 500);
});

export default {
  fetch: app.fetch.bind(app),

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    if (event.cron === '0 * * * *') {
      // expire audit links
      await env.DB
        .prepare(
          `UPDATE audit_links SET status = 'expired'
           WHERE status = 'active' AND expires_at < datetime('now')`
        )
        .run();
    }
    if (event.cron === '0 6 * * *') {
      await autoCreateOverdueOS(env.DB);
      const appUrl = env.APP_URL ?? 'https://house-log.vercel.app';
      await sendMaintenanceDueEmails(env.DB, env.RESEND_API_KEY ?? '', appUrl);
    }
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Bindings) {
    for (const msg of batch.messages) {
      if (msg.body.type === 'GENERATE_THUMBNAIL') {
        const { r2Key, itemId, itemType } = msg.body;
        const obj = await env.STORAGE.get(r2Key);
        if (!obj) {
          msg.ack();
          continue;
        }
        // TODO: implement real resize when Workers Image Resizing is available
        console.log(`Thumbnail queued for ${itemType}:${itemId}`);
        msg.ack();
      }
    }
  },
};
