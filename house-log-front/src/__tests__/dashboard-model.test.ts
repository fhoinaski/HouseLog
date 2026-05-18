import { describe, expect, it } from 'vitest';
import { buildDashboardModel, type BuildDashboardModelInput } from '@/components/dashboard/dashboard-model';

const baseInput: BuildDashboardModelInput = {
  properties: [
    { id: 'property-a', name: 'Casa Jardim', address: 'Rua A' },
    { id: 'property-b', name: 'Apartamento Lago', address: 'Rua B' },
  ],
  services: [],
  serviceRequests: [],
  warranties: [],
  documents: [],
  now: new Date('2026-05-18T12:00:00.000Z'),
};

describe('buildDashboardModel', () => {
  it('derives operational metrics, pipeline and pending items from real dashboard inputs', () => {
    const model = buildDashboardModel({
      ...baseInput,
      services: [
        {
          id: 'service-1',
          propertyId: 'property-a',
          title: 'Vazamento no shaft',
          status: 'in_progress',
          priority: 'urgent',
          createdAt: '2026-05-15T10:00:00.000Z',
          scheduledAt: null,
          completedAt: null,
          assignedToName: 'Equipe tecnica',
          cost: null,
        },
        {
          id: 'service-2',
          propertyId: 'property-b',
          title: 'Revisao eletrica',
          status: 'completed',
          priority: 'normal',
          createdAt: '2026-05-10T10:00:00.000Z',
          scheduledAt: null,
          completedAt: '2026-05-16T10:00:00.000Z',
          assignedToName: null,
          cost: 850,
        },
      ],
      serviceRequests: [
        {
          id: 'request-1',
          propertyId: 'property-a',
          title: 'Troca de pressurizador',
          status: 'OPEN',
          createdAt: '2026-05-14T10:00:00.000Z',
          updatedAt: '2026-05-17T10:00:00.000Z',
          proposalsCount: 2,
          pendingProposalsCount: 2,
          acceptedProposalsCount: 0,
          bestAmount: 1200,
        },
      ],
      warranties: [
        {
          id: 'warranty-1',
          propertyId: 'property-b',
          title: 'Ar-condicionado suite',
          providerName: 'Clima Pro',
          status: 'active',
          endDate: '2026-06-02',
          createdAt: '2026-01-02T10:00:00.000Z',
        },
      ],
      documents: [
        {
          id: 'document-1',
          propertyId: 'property-a',
          title: 'ART impermeabilizacao',
          type: 'warranty',
          createdAt: '2026-05-13T10:00:00.000Z',
          expiryDate: '2026-05-28',
        },
      ],
    });

    expect(model.metrics).toMatchObject({
      activeProperties: 2,
      openTickets: 2,
      inProgressOrders: 1,
      pendingBudgets: 1,
      expiringWarranties: 1,
      documents: 1,
    });
    expect(model.pipeline.find((stage) => stage.id === 'budget')?.count).toBe(1);
    expect(model.criticalPendings.map((item) => item.id)).toEqual(
      expect.arrayContaining(['service-service-1', 'request-request-1', 'warranty-warranty-1', 'document-document-1'])
    );
    expect(model.activities[0]?.id).toBe('request-request-1');
  });

  it('returns empty operational states without fabricating production data', () => {
    const model = buildDashboardModel(baseInput);

    expect(model.metrics).toEqual({
      activeProperties: 2,
      openTickets: 0,
      inProgressOrders: 0,
      pendingBudgets: 0,
      expiringWarranties: 0,
      documents: 0,
    });
    expect(model.pipeline.every((stage) => stage.count === 0)).toBe(true);
    expect(model.activities).toEqual([]);
    expect(model.criticalPendings).toEqual([]);
  });

  it('ignores rows outside the loaded property set to avoid cross-property leakage in the view model', () => {
    const model = buildDashboardModel({
      ...baseInput,
      services: [
        {
          id: 'foreign-service',
          propertyId: 'foreign-property',
          title: 'Nao deve aparecer',
          status: 'in_progress',
          priority: 'urgent',
          createdAt: '2026-05-15T10:00:00.000Z',
          scheduledAt: null,
          completedAt: null,
          assignedToName: null,
          cost: null,
        },
      ],
    });

    expect(model.metrics.openTickets).toBe(0);
    expect(model.criticalPendings).toEqual([]);
    expect(model.activities).toEqual([]);
  });
});
