import { qs, request } from '@/lib/api/_core';
import type {
  HandoverChecklistItem,
  HandoverChecklistItemCategory,
  HandoverChecklistItemCondition,
  HandoverChecklistItemCreateInput,
  HandoverChecklistItemStatus,
  HandoverChecklistItemStatusUpdateInput,
  HandoverChecklistItemUpdateInput,
  HandoverPackageDeliveryEvent,
  HandoverPackageDeliveryEventInput,
  HandoverPackage,
  HandoverPackageCreateInput,
  HandoverPackageStatus,
  HandoverPackageType,
  HandoverPackageUpdateInput,
} from '@houselog/contracts';

export type {
  HandoverChecklistItem,
  HandoverChecklistItemCreateInput,
  HandoverChecklistItemUpdateInput,
  HandoverPackage,
  HandoverPackageCreateInput,
  HandoverPackageUpdateInput,
  HandoverPackageDeliveryEvent,
  HandoverPackageDeliveryEventInput,
};

export type HandoverPackageFilters = {
  status?: HandoverPackageStatus;
  type?: HandoverPackageType;
  reviewed_by?: string;
  approved_by?: string;
  summary_document_id?: string;
  created_from?: string;
  created_to?: string;
  completed_from?: string;
  completed_to?: string;
};

export type HandoverChecklistItemStatusInput = HandoverChecklistItemStatusUpdateInput;

export type HandoverPackageIssueInput = {
  expires_at?: string | null;
};

export type HandoverPackageIssueResponse = {
  package: HandoverPackage;
  publicAccessUrl: string;
};

export type HandoverChecklistItemFilters = {
  status?: HandoverChecklistItemStatus;
  category?: HandoverChecklistItemCategory;
  required?: 'true' | 'false';
  room_id?: string;
  inventory_item_id?: string;
  document_id?: string;
  service_order_id?: string;
  condition?: HandoverChecklistItemCondition;
};

export const handoverPackagesApi = {
  list: (propertyId: string, filters?: HandoverPackageFilters) =>
    request<{ packages: HandoverPackage[] }>(
      `/properties/${propertyId}/handover-packages${qs(filters)}`
    ),

  get: (propertyId: string, packageId: string) =>
    request<{ package: HandoverPackage }>(`/properties/${propertyId}/handover-packages/${packageId}`),

  create: (propertyId: string, data: HandoverPackageCreateInput) =>
    request<{ package: HandoverPackage }>(`/properties/${propertyId}/handover-packages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (propertyId: string, packageId: string, data: HandoverPackageUpdateInput) =>
    request<{ package: HandoverPackage }>(`/properties/${propertyId}/handover-packages/${packageId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  issue: (propertyId: string, packageId: string, data?: HandoverPackageIssueInput) =>
    request<HandoverPackageIssueResponse>(`/properties/${propertyId}/handover-packages/${packageId}/issue`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  delete: (propertyId: string, packageId: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/handover-packages/${packageId}`, {
      method: 'DELETE',
    }),

  deliveryEvents: (propertyId: string, packageId: string) =>
    request<{ events: HandoverPackageDeliveryEvent[] }>(
      `/properties/${propertyId}/handover-packages/${packageId}/delivery-events`
    ),

  recordDeliveryEvent: (propertyId: string, packageId: string, data: HandoverPackageDeliveryEventInput) =>
    request<{
      event: {
        channel: HandoverPackageDeliveryEvent['channel'];
        status: HandoverPackageDeliveryEvent['status'];
        recipientEmailMasked: string | null;
        created_at: string;
      };
    }>(`/properties/${propertyId}/handover-packages/${packageId}/delivery-events`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const handoverChecklistApi = {
  list: (propertyId: string, packageId: string, filters?: HandoverChecklistItemFilters) =>
    request<{ items: HandoverChecklistItem[] }>(
      `/properties/${propertyId}/handover-packages/${packageId}/items${qs(filters)}`
    ),

  get: (propertyId: string, packageId: string, itemId: string) =>
    request<{ item: HandoverChecklistItem }>(
      `/properties/${propertyId}/handover-packages/${packageId}/items/${itemId}`
    ),

  create: (propertyId: string, packageId: string, data: HandoverChecklistItemCreateInput) =>
    request<{ item: HandoverChecklistItem }>(
      `/properties/${propertyId}/handover-packages/${packageId}/items`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  update: (
    propertyId: string,
    packageId: string,
    itemId: string,
    data: HandoverChecklistItemUpdateInput
  ) =>
    request<{ item: HandoverChecklistItem }>(
      `/properties/${propertyId}/handover-packages/${packageId}/items/${itemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),

  updateStatus: (
    propertyId: string,
    packageId: string,
    itemId: string,
    data: HandoverChecklistItemStatusInput
  ) =>
    request<{ item: HandoverChecklistItem }>(
      `/properties/${propertyId}/handover-packages/${packageId}/items/${itemId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),

  delete: (propertyId: string, packageId: string, itemId: string) =>
    request<{ success: boolean }>(
      `/properties/${propertyId}/handover-packages/${packageId}/items/${itemId}`,
      {
        method: 'DELETE',
      }
    ),
};
