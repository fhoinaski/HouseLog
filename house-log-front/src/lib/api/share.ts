import { request } from './_core';
import type { PublicServiceView, ServiceShareLink } from './_core';

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8787';

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error((body as { error: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const shareApi = {
  createLink: (
    propertyId: string,
    serviceId: string,
    data?: {
      expires_hours?: number;
      provider_name?: string;
      provider_email?: string;
      provider_phone?: string;
      share_credentials?: boolean;
    }
  ) =>
    request<ServiceShareLink>(`/properties/${propertyId}/services/${serviceId}/share-link`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  getPublic: (token: string) => publicRequest<PublicServiceView>(`/api/v1/public/share/service/${token}`),

  updateStatus: (token: string, data: { action: 'accept' | 'start' | 'done'; provider_name?: string; notes?: string }) =>
    publicRequest<{ action: string; updated_at: string }>(`/api/v1/public/share/service/${token}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
