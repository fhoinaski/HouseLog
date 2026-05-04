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

export const PROVIDER_CATEGORY_OPTIONS = [
  { value: 'electrical', label: 'Elétrica' },
  { value: 'plumbing', label: 'Hidráulica' },
  { value: 'structural', label: 'Estrutural' },
  { value: 'waterproofing', label: 'Impermeabilização' },
  { value: 'painting', label: 'Pintura' },
  { value: 'flooring', label: 'Pisos e revestimentos' },
  { value: 'roofing', label: 'Telhado e cobertura' },
  { value: 'hvac', label: 'Climatização (HVAC)' },
  { value: 'solar', label: 'Energia solar' },
  { value: 'pool', label: 'Piscinas' },
  { value: 'gardening', label: 'Jardinagem' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'locksmith', label: 'Chaveiro' },
  { value: 'carpentry', label: 'Marcenaria' },
  { value: 'masonry', label: 'Alvenaria' },
  { value: 'automation', label: 'Automação' },
  { value: 'alarm_cctv', label: 'Alarme e CFTV' },
  { value: 'internet_network', label: 'Internet e rede' },
  { value: 'appliances', label: 'Eletrodomésticos' },
  { value: 'pest_control', label: 'Controle de pragas' },
  { value: 'glazing', label: 'Vidracaria' },
  { value: 'welding', label: 'Serralheria' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'drainage', label: 'Drenagem' },
  { value: 'gas', label: 'Gás' },
  { value: 'elevator', label: 'Elevador' },
  { value: 'facade', label: 'Fachada' },
  { value: 'general', label: 'Serviços gerais' },
] as const;

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
