import { qs, request } from '@/lib/api/_core';

export type TechnicalPointType =
  | 'valve' | 'pipe' | 'drain' | 'inspection_box' | 'electrical_panel'
  | 'conduit' | 'outlet' | 'switch' | 'gas_line' | 'hvac_line'
  | 'network_point' | 'sensor' | 'waterproofing_area' | 'structural_element' | 'other';

export type TechnicalPointRiskLevel = 'low' | 'medium' | 'high';

export type TechnicalPoint = {
  id: string;
  tenant_id: string;
  property_id: string;
  technical_system_id: string | null;
  room_id: string | null;
  name: string;
  type: TechnicalPointType;
  description: string | null;
  position_x: number | null;
  position_y: number | null;
  floor: number;
  reference_image_url: string | null;
  risk_level: TechnicalPointRiskLevel;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type CreateTechnicalPointInput = {
  technical_system_id?: string | null;
  room_id?: string | null;
  name: string;
  type: TechnicalPointType;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  floor?: number;
  reference_image_url?: string | null;
  risk_level?: TechnicalPointRiskLevel;
};

export type UpdateTechnicalPointInput = Partial<CreateTechnicalPointInput>;

export type TechnicalPointFilterInput = {
  technicalSystemId?: string;
  roomId?: string;
  type?: TechnicalPointType;
  riskLevel?: TechnicalPointRiskLevel;
};

export type TechnicalSystemType =
  | 'electrical' | 'plumbing' | 'sewage' | 'gas' | 'hvac' | 'solar'
  | 'automation' | 'network' | 'pool' | 'irrigation' | 'security'
  | 'fire' | 'waterproofing' | 'roofing' | 'structural' | 'finishes' | 'custom';

export type TechnicalSystemStatus = 'active' | 'attention' | 'critical' | 'inactive' | 'replaced';

export type TechnicalSystem = {
  id: string;
  tenant_id: string;
  property_id: string;
  name: string;
  type: TechnicalSystemType;
  description: string | null;
  location_summary: string | null;
  responsible_provider_id: string | null;
  installation_date: string | null;
  last_inspection_at: string | null;
  status: TechnicalSystemStatus;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type CreateTechnicalSystemInput = {
  name: string;
  type: TechnicalSystemType;
  description?: string | null;
  location_summary?: string | null;
  responsible_provider_id?: string | null;
  installation_date?: string | null;
  last_inspection_at?: string | null;
  status?: TechnicalSystemStatus;
};

export type UpdateTechnicalSystemInput = Partial<CreateTechnicalSystemInput>;

export const technicalSystemsApi = {
  list: (propertyId: string) =>
    request<{ systems: TechnicalSystem[] }>(`/properties/${propertyId}/technical-systems`),

  create: (propertyId: string, data: CreateTechnicalSystemInput) =>
    request<{ system: TechnicalSystem }>(`/properties/${propertyId}/technical-systems`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (propertyId: string, systemId: string, data: UpdateTechnicalSystemInput) =>
    request<{ system: TechnicalSystem }>(`/properties/${propertyId}/technical-systems/${systemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (propertyId: string, systemId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/technical-systems/${systemId}`, {
      method: 'DELETE',
    }),
};

export const technicalPointsApi = {
  list: (propertyId: string, filters?: TechnicalPointFilterInput) =>
    request<{ points: TechnicalPoint[] }>(`/properties/${propertyId}/technical-points${qs(filters)}`),

  create: (propertyId: string, data: CreateTechnicalPointInput) =>
    request<{ point: TechnicalPoint }>(`/properties/${propertyId}/technical-points`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (propertyId: string, pointId: string, data: UpdateTechnicalPointInput) =>
    request<{ point: TechnicalPoint }>(`/properties/${propertyId}/technical-points/${pointId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (propertyId: string, pointId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/technical-points/${pointId}`, {
      method: 'DELETE',
    }),
};
