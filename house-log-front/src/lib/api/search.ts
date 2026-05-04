import { qs, request } from '@/lib/api/_core';

export type SearchResult = {
  type: 'service' | 'document' | 'inventory' | 'maintenance';
  id: string;
  title: string;
  subtitle: string;
  property_id: string;
  href: string;
};

export const searchApi = {
  search: (q: string, propertyId?: string) =>
    request<{ results: SearchResult[] }>(`/search${qs({ q, propertyId })}`),
};
