import { qs, request } from '@/lib/api/_core';
import type { CursorPage, ServiceOrder } from '@/lib/api/_core';

export type ServiceRequestSummary = {
  id: string;
  property_id: string;
  requested_by: string;
  title: string;
  description: string | null;
  media_urls: string[];
  status: 'OPEN' | 'CLOSED';
  created_at: string;
  updated_at: string;
  proposals_count: number;
  pending_proposals_count: number;
  accepted_proposals_count: number;
  best_amount: number | null;
};

export type ServiceRequestBid = {
  id: string;
  service_request_id: string;
  provider_id: string;
  provider_name: string;
  provider_email: string;
  provider_phone: string | null;
  amount: number;
  scope: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  updated_at: string;
};

export type ServiceRequestConvertPayload = {
  title: string;
  system_type: ServiceOrder['system_type'];
  description?: string;
  room_id?: string;
  priority?: ServiceOrder['priority'];
  warranty_until?: string;
  scheduled_at?: string;
  checklist?: Array<{ item: string; done: boolean }>;
};

export const serviceRequestsApi = {
  list: (propertyId: string, params?: { cursor?: string; limit?: number }) =>
    request<CursorPage<ServiceRequestSummary>>(
      `/properties/${propertyId}/service-requests${qs(params)}`
    ),

  get: (propertyId: string, serviceRequestId: string) =>
    request<{
      service_request: Omit<ServiceRequestSummary, 'proposals_count' | 'pending_proposals_count' | 'accepted_proposals_count' | 'best_amount'>;
      bids: ServiceRequestBid[];
    }>(
      `/properties/${propertyId}/service-requests/${serviceRequestId}`
    ),

  acceptBid: (propertyId: string, serviceRequestId: string, bidId: string) =>
    request<{
      accepted_bid: {
        id: string;
        serviceRequestId: string;
        providerId: string;
        amount: number;
        scope: string;
        status: 'ACCEPTED';
        updatedAt: string;
      } | undefined;
      rejected_bids_count: number;
    }>(
      `/properties/${propertyId}/service-requests/${serviceRequestId}/bids/${bidId}/accept`,
      { method: 'PATCH', body: '{}' }
    ),

  convertToService: (propertyId: string, serviceRequestId: string, data: ServiceRequestConvertPayload) =>
    request<{ order: ServiceOrder }>(
      `/properties/${propertyId}/service-requests/${serviceRequestId}/convert-to-service`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};
