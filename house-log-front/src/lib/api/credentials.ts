import { request } from './_core';
import type { AccessCredential, AccessCredentialPayload, RevealedAccessCredential } from './_core';

export const credentialsApi = {
  list: (propertyId: string) =>
    request<{ credentials: AccessCredential[] }>(`/properties/${propertyId}/credentials`),

  create: (propertyId: string, data: AccessCredentialPayload) =>
    request<{ credential: AccessCredential }>(`/properties/${propertyId}/credentials`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<AccessCredentialPayload>) =>
    request<{ credential: AccessCredential }>(`/properties/${propertyId}/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  revealSecret: (propertyId: string, id: string) =>
    request<{ credential: RevealedAccessCredential }>(`/properties/${propertyId}/credentials/${id}/secret`),

  delete: (propertyId: string, id: string) =>
    request<{ deleted: boolean }>(`/properties/${propertyId}/credentials/${id}`, { method: 'DELETE' }),

  generateTempCode: (propertyId: string, id: string, data: { expires_hours?: number; provider_name?: string }) =>
    request<{ temp_pin: string; expires_at: string; expires_hours: number; note: string }>(
      `/properties/${propertyId}/credentials/${id}/generate-temp-code`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};
