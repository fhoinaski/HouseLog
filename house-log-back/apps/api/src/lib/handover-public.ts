import type { HandoverPackageStatus, HandoverPackagePublic } from '@houselog/contracts';
import {
  HandoverPackagePublicDtoSchema,
  HandoverPackageSnapshotSchema,
} from '@houselog/contracts';
import { sha256Hex } from './handover-issue';

export type PublicHandoverPackageRow = {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  issuer_name: string | null;
  issuer_role: string | null;
  responsible_name: string | null;
  company_name: string | null;
  type: string;
  status: HandoverPackageStatus;
  version: number;
  issued_at: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  acceptance_notes: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
  snapshot_json: unknown;
};

export function maskPublicHandoverEmail(email: string | null): string {
  if (!email) return 'Nao informado';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return 'Email informado';
  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}${'*'.repeat(Math.max(2, localPart.length - visiblePrefix.length))}@${domain}`;
}

export async function hashPublicHandoverToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export function resolvePublicHandoverPackage(
  row: PublicHandoverPackageRow | null,
  now: Date = new Date()
):
  | { ok: true; package: HandoverPackagePublic }
  | { ok: false; status: 404; code: 'NOT_FOUND' }
  | { ok: false; status: 410; code: 'LINK_EXPIRED' | 'PACKAGE_REVOKED' }
  | { ok: false; status: 500; code: 'INTERNAL_ERROR' } {
  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND' };
  if (row.revoked_at || row.status === 'revoked') {
    return { ok: false, status: 410, code: 'PACKAGE_REVOKED' };
  }
  if (row.status === 'expired') {
    return { ok: false, status: 410, code: 'LINK_EXPIRED' };
  }
  if (row.status !== 'issued' && row.status !== 'accepted') {
    return { ok: false, status: 404, code: 'NOT_FOUND' };
  }

  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : Number.NaN;
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return { ok: false, status: 410, code: 'LINK_EXPIRED' };
  }

  const snapshot = HandoverPackageSnapshotSchema.safeParse(row.snapshot_json);
  if (!snapshot.success) {
    return { ok: false, status: 500, code: 'INTERNAL_ERROR' };
  }

  const acceptanceReceipt = row.status === 'accepted' && row.accepted_at && row.accepted_by_name
    ? {
        acceptedAt: row.accepted_at,
        acceptedByName: row.accepted_by_name,
        acceptedByEmailMasked: maskPublicHandoverEmail(row.accepted_by_email),
        acceptanceNotes: row.acceptance_notes,
        packageStatus: 'accepted' as const,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        packageTitle: row.title,
        propertySummary: {
          name: snapshot.data.property.name,
          type: snapshot.data.property.type,
          city: snapshot.data.property.city,
        },
      }
    : null;

  const dto = HandoverPackagePublicDtoSchema.safeParse({
    id: row.id,
    property_id: row.property_id,
    title: row.title,
    description: row.description,
    issuerName: row.issuer_name,
    issuerRole: row.issuer_role,
    responsibleName: row.responsible_name,
    companyName: row.company_name,
    type: row.type,
    status: row.status,
    version: row.version,
    issued_at: row.issued_at,
    accepted_at: row.accepted_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    snapshot_json: snapshot.data,
    acceptanceReceipt,
  });

  if (!dto.success) {
    return { ok: false, status: 500, code: 'INTERNAL_ERROR' };
  }

  return { ok: true, package: dto.data };
}
