import { qs, request } from './_core';
import type { CursorPage, ProviderNetworkOpportunity, ProviderPublicProfile, ProviderServiceOrder, ServiceBid } from './_core';

export const providerApi = {
  services: (params?: { status?: string; cursor?: string }) =>
    request<CursorPage<ProviderServiceOrder>>(`/provider/services${qs(params)}`),

  opportunities: (params?: { system_type?: string; cursor?: string }) =>
    request<CursorPage<ProviderNetworkOpportunity>>(`/provider/opportunities${qs(params)}`),

  getOpportunity: (id: string) =>
    request<{ order: ProviderServiceOrder; my_bids: ServiceBid[] }>(`/provider/opportunities/${id}`),

  getService: (id: string) =>
    request<{ order: ProviderServiceOrder; my_bids: ServiceBid[] }>(`/provider/services/${id}`),

  stats: () => request<{ stats: Record<string, number>; total: number; recent_bids: ServiceBid[] }>('/provider/stats'),
};

// Backend routes still use /marketplace for compatibility, but frontend naming
// should reflect the private curated provider network model.
export const providerNetworkApi = {
  providerProfile: (providerId: string) =>
    request<ProviderPublicProfile>(`/marketplace/providers/${providerId}/profile`),

  endorseProvider: (providerId: string, notes?: string) =>
    request<{ id: string; provider_id: string; status: 'APPROVED' }>('/marketplace/providers/endorse', {
      method: 'POST',
      body: JSON.stringify({ provider_id: providerId, notes }),
    }),
};
