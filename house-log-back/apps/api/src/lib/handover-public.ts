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
  type: string;
  status: HandoverPackageStatus;
  version: number;
  issued_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
  snapshot_json: unknown;
};

export async function hashPublicHandoverToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export function resolvePublicHandoverPackage(
  row: PublicHandoverPackageRow | null,
  now: Date = new Date()
):
  | { ok: true; package: HandoverPackagePublic }
  | { ok: false; status: 404; code: 'NOT_FOUND' }
  | { ok: false; status: 500; code: 'INTERNAL_ERROR' } {
  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND' };
  if (row.status !== 'issued' && row.status !== 'accepted') {
    return { ok: false, status: 404, code: 'NOT_FOUND' };
  }
  if (row.revoked_at) return { ok: false, status: 404, code: 'NOT_FOUND' };

  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : Number.NaN;
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return { ok: false, status: 404, code: 'NOT_FOUND' };
  }

  const snapshot = HandoverPackageSnapshotSchema.safeParse(row.snapshot_json);
  if (!snapshot.success) {
    return { ok: false, status: 500, code: 'INTERNAL_ERROR' };
  }

  const dto = HandoverPackagePublicDtoSchema.safeParse({
    id: row.id,
    property_id: row.property_id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    version: row.version,
    issued_at: row.issued_at,
    accepted_at: row.accepted_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    snapshot_json: snapshot.data,
  });

  if (!dto.success) {
    return { ok: false, status: 500, code: 'INTERNAL_ERROR' };
  }

  return { ok: true, package: dto.data };
}
