import type { HandoverPackageStatus, HandoverPackagePublic, HandoverPackagePublicSnapshot } from '@houselog/contracts';
import {
  HandoverPackagePublicDtoSchema,
  HandoverPackagePublicSnapshotSchema,
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
  accepted_signature_data_url?: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
  snapshot_json: unknown;
};

export function sanitizePublicHandoverSnapshot(snapshot: unknown): HandoverPackagePublicSnapshot | null {
  const parsed = HandoverPackageSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return null;

  const source = parsed.data;
  const publicSnapshot = HandoverPackagePublicSnapshotSchema.safeParse({
    generatedAt: source.generatedAt,
    property: {
      name: source.property.name,
      type: source.property.type,
      address: source.property.address,
      city: source.property.city,
      areaM2: source.property.areaM2,
      yearBuilt: source.property.yearBuilt,
      structure: source.property.structure,
      floors: source.property.floors,
      healthScore: source.property.healthScore,
    },
    package: {
      title: source.package.title,
      type: source.package.type,
      version: source.package.version,
      status: source.package.status,
    },
    rooms: source.rooms.map((room) => ({
      name: room.name,
      type: room.type,
      floor: room.floor,
      areaM2: room.areaM2,
    })),
    documents: source.documents.map((document) => ({
      title: document.title,
      type: document.type,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
    })),
    technicalSystems: source.technicalSystems.map((system) => ({
      name: system.name,
      type: system.type,
      status: system.status,
      locationSummary: system.locationSummary,
      lastInspectionAt: system.lastInspectionAt,
    })),
    inventoryItems: source.inventoryItems.map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      warrantyUntil: item.warrantyUntil,
    })),
    warranties: source.warranties.map((warranty) => ({
      title: warranty.title,
      warrantyType: warranty.warrantyType,
      status: warranty.status,
      startDate: warranty.startDate,
      endDate: warranty.endDate,
      providerName: warranty.providerName,
    })),
    maintenanceSchedules: source.maintenanceSchedules.map((schedule) => ({
      title: schedule.title,
      systemType: schedule.systemType,
      responsible: schedule.responsible,
      frequency: schedule.frequency,
      lastDone: schedule.lastDone,
      nextDue: schedule.nextDue,
      autoCreateOs: schedule.autoCreateOs,
    })),
    checklistItems: source.checklistItems.map((item) => ({
      title: item.title,
      category: item.category,
      status: item.status,
      required: item.required,
      condition: item.condition,
      completedAt: item.completedAt,
    })),
  });

  return publicSnapshot.success ? publicSnapshot.data : null;
}

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

  const snapshot = sanitizePublicHandoverSnapshot(row.snapshot_json);
  if (!snapshot) {
    return { ok: false, status: 500, code: 'INTERNAL_ERROR' };
  }

  const acceptanceReceipt = row.status === 'accepted' && row.accepted_at && row.accepted_by_name
    ? {
        acceptedAt: row.accepted_at,
        acceptedByName: row.accepted_by_name,
        acceptedByEmailMasked: maskPublicHandoverEmail(row.accepted_by_email),
        acceptanceNotes: row.acceptance_notes,
        hasSignature: !!row.accepted_signature_data_url,
        packageStatus: 'accepted' as const,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        packageTitle: row.title,
        propertySummary: {
          name: snapshot.property.name,
          type: snapshot.property.type,
          city: snapshot.property.city,
        },
      }
    : null;

  const dto = HandoverPackagePublicDtoSchema.safeParse({
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
    snapshot_json: snapshot,
    acceptanceReceipt,
  });

  if (!dto.success) {
    return { ok: false, status: 500, code: 'INTERNAL_ERROR' };
  }

  return { ok: true, package: dto.data };
}
