import { nanoid } from 'nanoid';
import type { HandoverPackageStatus } from '@houselog/contracts';
import type { Role, TenantRole } from './types';

type SnapshotProperty = {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  areaM2: number | null;
  yearBuilt: number | null;
  structure: string | null;
  floors: number | null;
  healthScore: number;
};

type SnapshotPackage = {
  id: string;
  title: string;
  type: string;
  version: number;
  status: HandoverPackageStatus;
};

export type HandoverPackageSnapshot = {
  generatedAt: string;
  property: SnapshotProperty;
  package: SnapshotPackage;
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    floor: number | null;
    areaM2: number | null;
  }>;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    issueDate: string | null;
    expiryDate: string | null;
  }>;
  technicalSystems: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    locationSummary: string | null;
    lastInspectionAt: string | null;
  }>;
  inventoryItems: Array<{
    id: string;
    name: string;
    category: string;
    roomId: string | null;
    quantity: number | null;
    unit: string | null;
    warrantyUntil: string | null;
  }>;
  warranties: Array<{
    id: string;
    title: string;
    warrantyType: string;
    status: string;
    startDate: string | null;
    endDate: string;
    providerName: string | null;
  }>;
  maintenanceSchedules: Array<{
    id: string;
    title: string;
    systemType: string;
    responsible: string | null;
    frequency: string | null;
    lastDone: string | null;
    nextDue: string | null;
    autoCreateOs: boolean;
  }>;
  checklistItems: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    required: boolean;
    condition: string | null;
    completedAt: string | null;
    roomId: string | null;
    documentId: string | null;
    inventoryItemId: string | null;
    serviceOrderId: string | null;
  }>;
};

type HexString = string;

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): HexString {
  return Array.from(new Uint8Array(buf))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(input: string): Promise<HexString> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return toHex(digest);
}

export function buildHandoverPackageSnapshot(input: {
  generatedAt: string;
  property: SnapshotProperty;
  package: SnapshotPackage;
  rooms: HandoverPackageSnapshot['rooms'];
  documents: HandoverPackageSnapshot['documents'];
  technicalSystems: HandoverPackageSnapshot['technicalSystems'];
  inventoryItems: HandoverPackageSnapshot['inventoryItems'];
  warranties: HandoverPackageSnapshot['warranties'];
  maintenanceSchedules: HandoverPackageSnapshot['maintenanceSchedules'];
  checklistItems: HandoverPackageSnapshot['checklistItems'];
}): HandoverPackageSnapshot {
  return {
    generatedAt: input.generatedAt,
    property: input.property,
    package: input.package,
    rooms: input.rooms,
    documents: input.documents,
    technicalSystems: input.technicalSystems,
    inventoryItems: input.inventoryItems,
    warranties: input.warranties,
    maintenanceSchedules: input.maintenanceSchedules,
    checklistItems: input.checklistItems,
  };
}

export async function buildHandoverPackageHash(input: {
  packageId: string;
  version: number;
  issuedAt: string;
  expiresAt: string | null;
  snapshotJson: HandoverPackageSnapshot;
}): Promise<string> {
  const payload = JSON.stringify({
    packageId: input.packageId,
    version: input.version,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    snapshotJson: input.snapshotJson,
  });
  return sha256Hex(payload);
}

export async function generatePublicAccessToken(): Promise<{ token: string; tokenHash: string }> {
  const token = nanoid(48);
  const tokenHash = await sha256Hex(token);
  return { token, tokenHash };
}

export function buildPublicAccessUrl(appUrl: string, token: string): string {
  const baseUrl = appUrl.replace(/\/$/, '');
  return `${baseUrl}/handover/${encodeURIComponent(token)}`;
}

export function canIssueHandoverPackage(input: {
  tenantId?: string | null;
  tenantRole?: TenantRole | null;
  userId: string;
  userRole: Role;
  propertyOwnerId: string;
  propertyManagerId: string | null;
  packageStatus: HandoverPackageStatus;
  issuedAt: string | null;
  revokedAt: string | null;
  acceptedAt: string | null;
  publicAccessTokenHash: string | null;
}):
  | { allowed: true }
  | { allowed: false; status: 400 | 403 | 409; code: 'TENANT_REQUIRED' | 'FORBIDDEN' | 'CONFLICT' } {
  if (!input.tenantId || !input.tenantRole) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }

  if (input.userRole === 'provider' || input.userRole === 'temp_provider') {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  const alreadyIssued =
    input.packageStatus !== 'ready_to_issue' ||
    input.issuedAt !== null ||
    input.revokedAt !== null ||
    input.acceptedAt !== null ||
    input.publicAccessTokenHash !== null;
  if (alreadyIssued) {
    return { allowed: false, status: 409, code: 'CONFLICT' };
  }

  if (input.userRole === 'admin') return { allowed: true };
  if (input.tenantRole === 'owner' || input.tenantRole === 'manager') return { allowed: true };
  if (input.propertyOwnerId === input.userId || input.propertyManagerId === input.userId) {
    return { allowed: true };
  }

  return { allowed: false, status: 403, code: 'FORBIDDEN' };
}

export function canRevokeHandoverPackage(input: {
  tenantId?: string | null;
  tenantRole?: TenantRole | null;
  userId: string;
  userRole: Role;
  propertyOwnerId: string;
  propertyManagerId: string | null;
  packageStatus: HandoverPackageStatus;
  issuedAt: string | null;
  revokedAt: string | null;
  publicAccessTokenHash: string | null;
}):
  | { allowed: true }
  | { allowed: false; status: 400 | 403 | 409; code: 'TENANT_REQUIRED' | 'FORBIDDEN' | 'CONFLICT' } {
  if (!input.tenantId || !input.tenantRole) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }

  if (input.userRole === 'provider' || input.userRole === 'temp_provider') {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  const canManage =
    input.userRole === 'admin' ||
    input.tenantRole === 'owner' ||
    input.tenantRole === 'manager' ||
    input.propertyOwnerId === input.userId ||
    input.propertyManagerId === input.userId;

  if (!canManage) {
    return { allowed: false, status: 403, code: 'FORBIDDEN' };
  }

  if (
    input.revokedAt !== null ||
    input.packageStatus === 'revoked' ||
    (input.packageStatus !== 'issued' && input.packageStatus !== 'accepted') ||
    input.issuedAt === null ||
    input.publicAccessTokenHash === null
  ) {
    return { allowed: false, status: 409, code: 'CONFLICT' };
  }

  return { allowed: true };
}
