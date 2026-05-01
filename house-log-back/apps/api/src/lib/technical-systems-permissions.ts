import type { Role } from './types';

type PropertyCollaboratorRole = 'viewer' | 'provider' | 'manager';

export type TechnicalSystemPermissionInput = {
  userId: string;
  role: Role;
  property: {
    tenantId: string | null;
    ownerId: string;
    managerId: string | null;
  };
  collaboratorRole?: PropertyCollaboratorRole | null;
};

export type TechnicalSystemPermissionResult = {
  hasTenant: boolean;
  canView: boolean;
  canManage: boolean;
};

export function resolveTechnicalSystemPermissions(
  input: TechnicalSystemPermissionInput
): TechnicalSystemPermissionResult {
  if (!input.property.tenantId) {
    return { hasTenant: false, canView: false, canManage: false };
  }

  const isDirectManager =
    input.property.ownerId === input.userId || input.property.managerId === input.userId;
  const hasCollaboratorAccess = !!input.collaboratorRole;
  const canView = isDirectManager || hasCollaboratorAccess;
  const canManage =
    input.role !== 'provider' &&
    input.role !== 'temp_provider' &&
    (isDirectManager || input.collaboratorRole === 'manager');

  return { hasTenant: true, canView, canManage };
}
