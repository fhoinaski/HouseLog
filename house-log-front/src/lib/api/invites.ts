import { BASE, getToken, request } from '@/lib/api/_core';

export type PropertyCollaborator = {
  id: string;
  user_id: string;
  role: 'viewer' | 'provider' | 'manager';
  can_open_os: number;
  specialties?: string | null;
  whatsapp?: string | null;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
};

export type PropertyTemporaryProvider = {
  id: string;
  service_id: string;
  service_title: string;
  provider_name: string | null;
  provider_email: string | null;
  provider_phone: string | null;
  provider_accepted_at: string | null;
  provider_started_at: string | null;
  provider_done_at: string | null;
  expires_at: string;
  created_at: string;
};

export type PropertyProviderHistory = {
  service_id: string;
  service_title: string;
  provider_id: string | null;
  provider_name: string;
  provider_email: string;
  provider_phone: string | null;
  status: 'completed' | 'verified';
  completed_at: string | null;
  created_at: string;
};

export type PropertyInvite = {
  id: string;
  property_id: string;
  invited_by: string;
  invited_by_name: string;
  email: string;
  invite_name?: string | null;
  whatsapp?: string | null;
  role: 'viewer' | 'provider' | 'manager';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type InviteDetails = {
  email: string | null;
  invite_name?: string | null;
  whatsapp?: string | null;
  role: string;
  expires_at: string;
  property_name: string;
  property_address: string;
  property_city: string;
  invited_by_name: string;
};

export type InviteCardSuggestion = {
  name: string;
  email: string;
  whatsapp: string;
  specialties: string[];
  confidence: number;
  notes: string;
};

export const invitesApi = {
  list: (propertyId: string) =>
    request<{
      invites: PropertyInvite[];
      collaborators: PropertyCollaborator[];
      temporary_providers: PropertyTemporaryProvider[];
      provider_history: PropertyProviderHistory[];
    }>(
      `/properties/${propertyId}/invites`
    ),

  create: (
    propertyId: string,
    data: {
      name?: string;
      email?: string;
      role: 'viewer' | 'provider' | 'manager';
      specialties?: string[];
      whatsapp?: string;
    }
  ) =>
    request<{ id: string; token: string; expires_at: string; invite_url: string; delivery: 'email' | 'whatsapp_link' }>(
      `/properties/${propertyId}/invites`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  extractFromCard: async (propertyId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE}/properties/${propertyId}/invites/extract-card`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Erro ao extrair dados do cartão' }));
      throw new Error((body as { error?: string }).error ?? 'Erro ao extrair dados do cartão');
    }

    return res.json() as Promise<{ suggestion: InviteCardSuggestion }>;
  },

  cancel: (propertyId: string, inviteId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/invites/${inviteId}`, { method: 'DELETE' }),

  updatePermissions: (propertyId: string, collabId: string, can_open_os: boolean) =>
    request<{ success: boolean }>(
      `/properties/${propertyId}/collaborators/${collabId}`,
      { method: 'PATCH', body: JSON.stringify({ can_open_os }) }
    ),

  addCollaborator: (
    propertyId: string,
    data: { user_id: string; role: 'provider' | 'manager' | 'viewer'; can_open_os?: boolean }
  ) =>
    request<{ collaborator: PropertyCollaborator; already_exists: boolean }>(
      `/properties/${propertyId}/collaborators`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  removeCollaborator: (propertyId: string, collabId: string) =>
    request<{ success: boolean }>(
      `/properties/${propertyId}/collaborators/${collabId}`,
      { method: 'DELETE' }
    ),

  getInvite: (token: string) =>
    request<InviteDetails>(`/invite/${token}`),

  acceptInvite: (token: string) =>
    request<{ success: boolean; property_id: string; role: string }>(
      `/invite/${token}/accept`,
      { method: 'POST', body: '{}' }
    ),
};
