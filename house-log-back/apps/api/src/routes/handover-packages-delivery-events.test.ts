import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handoverPackagesRoute from './handover-packages';
import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import { sendEmail } from '../lib/email';

const authState = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner',
  tenantId: 'tenant-1',
  tenantRole: 'owner',
  propertyAccess: true,
}));

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../lib/email', async () => {
  const actual = await vi.importActual<typeof import('../lib/email')>('../lib/email');
  return {
    ...actual,
    sendEmail: vi.fn(async () => undefined),
  };
});

vi.mock('../lib/handover-public', () => ({
  hashPublicHandoverToken: vi.fn(async (token: string) => token === 'valid-token-123' ? 'valid-token-hash' : 'other-token-hash'),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('userId', authState.userId);
    c.set('userRole', authState.userRole);
    await next();
  },
  resolveTenant: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('tenantId', authState.tenantId);
    c.set('tenantRole', authState.tenantRole);
    await next();
  },
  assertPropertyAccess: vi.fn(async () => authState.propertyAccess),
}));

type PackageRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  title: string;
  description: string | null;
  type: 'handover';
  status: 'issued' | 'accepted' | 'revoked' | 'draft';
  version: number;
  prepared_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  summary_document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  issued_at: string | null;
  issued_by: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  public_access_token_hash: string | null;
  snapshot_json: Record<string, unknown> | null;
  package_hash: string | null;
};

const basePackage: PackageRow = {
  id: 'package-1',
  tenant_id: 'tenant-1',
  property_id: 'property-1',
  title: 'Dossie de entrega',
  description: null,
  type: 'handover',
  status: 'issued',
  version: 1,
  prepared_by: 'user-1',
  reviewed_by: null,
  approved_by: null,
  approved_at: null,
  completed_at: null,
  summary_document_id: null,
  notes: null,
  created_at: '2026-05-09T10:00:00.000Z',
  updated_at: null,
  deleted_at: null,
  issued_at: '2026-05-09T10:05:00.000Z',
  issued_by: 'user-1',
  accepted_at: null,
  accepted_by_name: null,
  accepted_by_email: null,
  revoked_at: null,
  revoked_by: null,
  revoke_reason: null,
  expires_at: '2026-06-09T10:05:00.000Z',
  public_access_token_hash: 'valid-token-hash',
  snapshot_json: {
    property: { name: 'Apartamento Jardim' },
  },
  package_hash: 'package-hash',
};

function buildEnv() {
  return {
    DB: {},
    APP_URL: 'https://app.houselog.local',
    RESEND_API_KEY: 'resend-key',
  };
}

function buildApp() {
  const app = new Hono();
  app.route('/properties/:propertyId/handover-packages', handoverPackagesRoute);
  return app;
}

function createDb(packageRow: PackageRow | null = basePackage) {
  const selectResponses: unknown[][] = [
    [{ id: 'property-1' }],
    packageRow ? [packageRow] : [],
  ];

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResponses.shift() ?? []),
          orderBy: vi.fn(async () => selectResponses.shift() ?? []),
        })),
        orderBy: vi.fn(async () => selectResponses.shift() ?? []),
      })),
    })),
  };
}

function deliveryRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/properties/property-1/handover-packages/package-1/delivery-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.77',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /properties/:propertyId/handover-packages/:id/delivery-events', () => {
  it('registra copia de link sem vazar token no audit log', async () => {
    vi.mocked(getDb).mockReturnValue(createDb() as never);

    const response = await buildApp().fetch(deliveryRequest({
      channel: 'copy_link',
      publicAccessUrl: 'https://app.houselog.local/handover/valid-token-123',
    }), buildEnv());

    expect(response.status).toBe(200);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-1',
      propertyId: 'property-1',
      entityType: 'handover_package',
      entityId: 'package-1',
      action: 'handover_package_link_copied',
      actorId: 'user-1',
      actorIp: '203.0.113.77',
    }));
    const auditPayload = JSON.stringify(vi.mocked(writeAuditLog).mock.calls);
    expect(auditPayload).not.toContain('valid-token-123');
    expect(auditPayload).not.toContain('valid-token-hash');
  });

  it('envia email via Resend e audita destinatario mascarado', async () => {
    vi.mocked(getDb).mockReturnValue(createDb() as never);

    const response = await buildApp().fetch(deliveryRequest({
      channel: 'email',
      publicAccessUrl: 'https://app.houselog.local/handover/valid-token-123',
      recipientEmail: 'cliente@example.com',
      recipientName: 'Cliente',
    }), buildEnv());

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith('resend-key', expect.objectContaining({
      to: 'cliente@example.com',
      subject: 'Entrega digital: Dossie de entrega',
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'handover_package_email_sent',
      newData: expect.objectContaining({
        channel: 'email',
        status: 'sent',
        recipient_email_masked: 'cl*****@example.com',
        has_public_link: true,
      }),
    }));
    const auditPayload = JSON.stringify(vi.mocked(writeAuditLog).mock.calls);
    expect(auditPayload).not.toContain('valid-token-123');
    expect(auditPayload).not.toContain('cliente@example.com');
  });

  it('bloqueia link que nao corresponde ao hash do pacote', async () => {
    vi.mocked(getDb).mockReturnValue(createDb() as never);

    const response = await buildApp().fetch(deliveryRequest({
      channel: 'whatsapp',
      publicAccessUrl: 'https://app.houselog.local/handover/other-token',
    }), buildEnv());

    expect(response.status).toBe(422);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('bloqueia email quando Resend nao esta configurado', async () => {
    vi.mocked(getDb).mockReturnValue(createDb() as never);

    const response = await buildApp().fetch(deliveryRequest({
      channel: 'email',
      publicAccessUrl: 'https://app.houselog.local/handover/valid-token-123',
      recipientEmail: 'cliente@example.com',
    }), {
      ...buildEnv(),
      RESEND_API_KEY: '',
    });

    expect(response.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
