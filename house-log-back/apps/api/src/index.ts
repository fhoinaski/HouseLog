import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimitMiddleware } from './middleware/rateLimit';
import auth from './routes/auth';
import properties from './routes/properties';
import rooms from './routes/rooms';
import inventory from './routes/inventory';
import services from './routes/services';
import serviceRequests from './routes/service-requests';
import serviceRequestBids from './routes/service-request-bids';
import expenses from './routes/expenses';
import documents from './routes/documents';
import auditLinks from './routes/audit-links';
import maintenance, { autoCreateOverdueOS, sendMaintenanceDueEmails } from './routes/maintenance';
import reports from './routes/reports';
import bids from './routes/bids';
import provider from './routes/provider';
import search from './routes/search';
import invites from './routes/invites';
import credentials from './routes/credentials';
import share from './routes/share';
import push from './routes/push';
import ai from './routes/ai';
import finance from './routes/finance';
import marketplace from './routes/marketplace';
import messagesRoute from './routes/messages';
import timeline from './routes/timeline';
import { requestLogger, reportError, log } from './lib/logger';
import { generateThumbnails } from './lib/image';
import { pushToUser } from './lib/webpush';
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

app.use('*', requestLogger);
app.use('/api/*', rateLimitMiddleware);

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/', (c) => c.json({ service: 'HouseLog API', version: '1.0.0', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes ───────────────────────────────────────────────────────────────────

const api = app.basePath('/api/v1');

// Auth
api.route('/auth', auth);

// Web Push
api.route('/push', push);

// IA (diagnose / transcribe / classify)
api.route('/ai', ai);

// Marketplace (ratings, matchmaking, agenda)
api.route('/marketplace', marketplace);

// Chat por OS (nested)
api.route('/services', messagesRoute);

// Properties CRUD + dashboard
api.route('/properties', properties);

// Nested under /properties/:propertyId
api.route('/properties/:propertyId/rooms',       rooms);
api.route('/properties/:propertyId/inventory',   inventory);
api.route('/properties/:propertyId/services',    services);
api.route('/properties/:propertyId/service-requests', serviceRequests);
api.route('/properties/:propertyId/service-requests/:serviceRequestId/bids', serviceRequestBids);
api.route('/properties/:propertyId/expenses',    expenses);
api.route('/properties/:propertyId/documents',   documents);
api.route('/properties/:propertyId/maintenance', maintenance);
api.route('/properties/:propertyId/finance',     finance);
api.route('/properties/:propertyId/timeline',    timeline);

// Reports: /api/v1/properties/:propertyId/report/...
api.route('/properties/:propertyId/report', reports);

// Bids (nested under property+service)
api.route('/properties/:propertyId/services/:serviceId/bids', bids);

// Provider portal
api.route('/provider', provider);

// Audit link creation (nested under property+service)
api.route('/properties/:propertyId/services/:serviceId/audit-link', auditLinks);

// Team invites and acceptance links
api.route('/', invites);

// Public audit endpoints (no auth required — handled inside the route)
api.route('/audit', auditLinks);

// Full-text search (services, documents/OCR, inventory, maintenance)
api.route('/search', search);

// Access credentials (wifi, alarm, smart lock, etc.)
api.route('/properties/:propertyId/credentials', credentials);

// Service order public share links (create + public read/update)
app.route('/api/v1', share);

// ── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: 'Rota não encontrada', code: 'NOT_FOUND' }, 404)
);

app.onError((err, c) => {
  void reportError(c, err);
  return c.json(
    { error: 'Erro interno', code: 'INTERNAL_ERROR', request_id: c.get('requestId') },
    500
  );
});

export default {
  fetch: app.fetch.bind(app),

  async scheduled(event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    try {
      if (event.cron === '0 * * * *') {
        await env.DB
          .prepare(
            `UPDATE audit_links SET status = 'expired'
             WHERE status = 'active' AND expires_at < datetime('now')`
          )
          .run();
        // Limpa refresh tokens expirados há mais de 7 dias
        await env.DB
          .prepare(
            `DELETE FROM refresh_tokens
             WHERE expires_at < datetime('now', '-7 days')`
          )
          .run();
        // Limpa mfa_challenges consumidos/expirados
        await env.DB
          .prepare(
            `DELETE FROM mfa_challenges
             WHERE expires_at < datetime('now', '-1 day')`
          )
          .run();
      }
      if (event.cron === '0 6 * * *') {
        await autoCreateOverdueOS(env.DB);
        const appUrl = env.APP_URL ?? 'https://house-log.vercel.app';
        await sendMaintenanceDueEmails(env.DB, env.RESEND_API_KEY ?? '', appUrl);
      }
    } catch (e) {
      log.error('scheduled_failed', { cron: event.cron, error: String(e) });
    }
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Bindings) {
    for (const msg of batch.messages) {
      try {
        if (msg.body.type === 'GENERATE_THUMBNAIL') {
          const { r2Key, itemId, itemType } = msg.body;
          const result = await generateThumbnails(env, r2Key);
          log.info('thumbnail_generated', { itemType, itemId, ...result });
        } else if (msg.body.type === 'SEND_PUSH') {
          await pushToUser(env.DB, env, msg.body.userId, msg.body.payload);
        }
        msg.ack();
      } catch (e) {
        log.error('queue_message_failed', { error: String(e) });
        msg.retry();
      }
    }
  },
};
