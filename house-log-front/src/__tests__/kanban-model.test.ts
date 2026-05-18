import { describe, expect, it } from 'vitest';
import {
  getServiceRequestStage,
  groupByStatus,
  SERVICE_ORDER_KANBAN_COLUMNS,
  SERVICE_ORDER_STATUS_FLOW,
  SERVICE_REQUEST_KANBAN_COLUMNS,
} from '@/components/operations/kanban-model';
import type { ServiceOrder } from '@/lib/api/_core';
import type { ServiceRequestSummary } from '@/lib/api/service-requests';

const baseOrder: ServiceOrder = {
  id: 'order-1',
  property_id: 'property-1',
  room_id: null,
  room_name: null,
  system_type: 'electrical',
  requested_by: 'user-1',
  requested_by_name: 'Cliente',
  assigned_to: null,
  assigned_to_name: null,
  title: 'Revisão elétrica',
  description: null,
  priority: 'normal',
  status: 'requested',
  cost: null,
  before_photos: '[]',
  after_photos: '[]',
  video_url: null,
  audio_url: null,
  checklist: '[]',
  warranty_until: null,
  scheduled_at: null,
  completed_at: null,
  created_at: '2026-05-18T12:00:00.000Z',
};

const baseRequest: ServiceRequestSummary = {
  id: 'request-1',
  property_id: 'property-1',
  requested_by: 'user-1',
  title: 'Orçamento hidráulico',
  description: null,
  media_urls: [],
  status: 'OPEN',
  created_at: '2026-05-18T12:00:00.000Z',
  updated_at: '2026-05-18T12:00:00.000Z',
  proposals_count: 0,
  pending_proposals_count: 0,
  accepted_proposals_count: 0,
  best_amount: null,
};

describe('kanban model', () => {
  it('groups service orders by real status columns', () => {
    const grouped = groupByStatus(
      [
        baseOrder,
        { ...baseOrder, id: 'order-2', status: 'in_progress' },
        { ...baseOrder, id: 'order-3', status: 'verified' },
      ],
      SERVICE_ORDER_KANBAN_COLUMNS,
      (order) => order.status
    );

    expect(grouped.requested).toHaveLength(1);
    expect(grouped.in_progress).toHaveLength(1);
    expect(grouped.verified).toHaveLength(1);
    expect(grouped.approved).toHaveLength(0);
  });

  it('derives request stages from request status and proposal counts', () => {
    expect(getServiceRequestStage(baseRequest)).toBe('waiting');
    expect(getServiceRequestStage({ ...baseRequest, proposals_count: 2 })).toBe('proposals');
    expect(getServiceRequestStage({ ...baseRequest, accepted_proposals_count: 1 })).toBe('approved');
    expect(getServiceRequestStage({ ...baseRequest, status: 'CLOSED' })).toBe('closed');
  });

  it('keeps kanban transitions inside the backend service order flow', () => {
    expect(SERVICE_ORDER_STATUS_FLOW.requested).toEqual(['approved']);
    expect(SERVICE_ORDER_STATUS_FLOW.approved).toEqual(['requested', 'in_progress']);
    expect(SERVICE_ORDER_STATUS_FLOW.in_progress).toEqual(['approved', 'completed']);
    expect(SERVICE_ORDER_STATUS_FLOW.completed).toEqual(['in_progress', 'verified']);
    expect(SERVICE_ORDER_STATUS_FLOW.verified).toEqual([]);
  });

  it('does not invent a cancelled service order column', () => {
    expect(SERVICE_ORDER_KANBAN_COLUMNS.map((column) => column.id)).toEqual([
      'requested',
      'approved',
      'in_progress',
      'completed',
      'verified',
    ]);
    expect(SERVICE_REQUEST_KANBAN_COLUMNS.map((column) => column.id)).toEqual([
      'waiting',
      'proposals',
      'approved',
      'closed',
    ]);
  });
});
