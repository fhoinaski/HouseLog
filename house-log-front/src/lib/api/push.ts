import { request } from '@/lib/api/_core';

export const pushApi = {
  publicKey: () => request<{ publicKey: string }>('/push/public-key'),

  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ id: string; created?: boolean; updated?: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(sub),
    }),

  unsubscribe: (endpoint: string) =>
    request<{ ok: true }>('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),

  test: () => request<{ sent: number }>('/push/test', { method: 'POST' }),
};
