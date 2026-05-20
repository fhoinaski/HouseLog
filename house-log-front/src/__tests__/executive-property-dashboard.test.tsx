import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PropertyDashboard } from '@/lib/api';
import { ExecutivePropertyDashboard } from '@/components/properties/executive-property-dashboard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function dashboard(overrides: Partial<PropertyDashboard> = {}): PropertyDashboard {
  return {
    health_score: 78,
    maintenance: { total: 3, overdue: 1, due_soon: 1 },
    expenses: { total: 1200, this_month: 300 },
    services: { total: 8, requested: 2, in_progress: 1, done: 5, urgent_open: 1 },
    inventory: { total: 12, low_stock: 2 },
    documents: { total: 9, pending_review: 2, failed_processing: 1, expiring_soon: 1, expired: 0 },
    warranties: { total: 4, active: 3, expiring_soon: 2, expired: 1 },
    handover: { total: 1, issued: 1, accepted: 0, dossier_status: 'issued' },
    last_event: {
      type: 'service_order_completed',
      title: 'Revisao eletrica concluida',
      at: '2026-05-01T10:00:00.000Z',
      entity_type: 'service_order',
      entity_id: 'os-1',
      severity: 'success',
    },
    monthly_expenses: [],
    warranties_expiring: [
      { id: 'war-1', name: 'Garantia do elevador', warranty_until: '2026-05-30', days_left: 10, source: 'warranty' },
    ],
    preventive_alerts: [
      {
        id: 'warranty-expiring-war-1',
        type: 'warranty_expiring',
        severity: 'warning',
        title: 'Garantia vence em 30 dias',
        description: 'Garantia do elevador vence em 10 dia(s).',
        entity_type: 'warranty',
        entity_id: 'war-1',
        due_date: '2026-05-30',
        days_delta: 10,
        action_href: '/properties/prop-1?tab=warranties',
      },
      {
        id: 'maintenance-overdue-maint-1',
        type: 'maintenance_overdue',
        severity: 'critical',
        title: 'Manutencao preventiva atrasada',
        description: 'Revisao eletrica esta atrasada ha 5 dia(s).',
        entity_type: 'maintenance_schedule',
        entity_id: 'maint-1',
        due_date: '2026-05-10',
        days_delta: -5,
        action_href: '/properties/prop-1/maintenance',
      },
    ],
    ...overrides,
  };
}

describe('ExecutivePropertyDashboard', () => {
  it('renderiza indicadores executivos com dados reais', () => {
    const html = renderToStaticMarkup(
      <ExecutivePropertyDashboard propertyId="prop-1" dashboard={dashboard()} isLoading={false} />
    );

    expect(html).toContain('Dashboard executivo');
    expect(html).toContain('Saude tecnica');
    expect(html).toContain('Documentos pendentes');
    expect(html).toContain('Garantias vencendo');
    expect(html).toContain('Alertas preventivos');
    expect(html).toContain('Garantia vence em 30 dias');
    expect(html).toContain('Manutencao preventiva atrasada');
    expect(html).toContain('Revisao eletrica concluida');
    expect(html).toContain('Dossie');
    expect(html).toContain('Emitido');
    expect(html).toContain('href="/properties/prop-1/services/os-1"');
  });

  it('mostra estado inicial quando o imovel ainda nao tem dados operacionais', () => {
    const html = renderToStaticMarkup(
      <ExecutivePropertyDashboard
        propertyId="prop-empty"
        dashboard={dashboard({
          services: { total: 0, requested: 0, in_progress: 0, done: 0, urgent_open: 0 },
          inventory: { total: 0, low_stock: 0 },
          documents: { total: 0, pending_review: 0, failed_processing: 0, expiring_soon: 0, expired: 0 },
          warranties: { total: 0, active: 0, expiring_soon: 0, expired: 0 },
          handover: { total: 0, issued: 0, accepted: 0, dossier_status: 'pending' },
          last_event: null,
          warranties_expiring: [],
          preventive_alerts: [],
        })}
        isLoading={false}
      />
    );

    expect(html).toContain('Dashboard em formacao');
    expect(html).toContain('Comecar por documentos');
  });

  it('mostra estado limpo quando nao ha alerta preventivo', () => {
    const html = renderToStaticMarkup(
      <ExecutivePropertyDashboard
        propertyId="prop-clean"
        dashboard={dashboard({ preventive_alerts: [] })}
        isLoading={false}
      />
    );

    expect(html).toContain('Imovel sem alertas preventivos');
    expect(html).toContain('Operacao limpa');
  });

  it('mostra erro controlado sem expor payload', () => {
    const html = renderToStaticMarkup(
      <ExecutivePropertyDashboard propertyId="prop-error" dashboard={undefined} isLoading={false} hasError onRetry={() => undefined} />
    );

    expect(html).toContain('Nao foi possivel carregar o dashboard');
    expect(html).toContain('Tentar novamente');
    expect(html).not.toContain('stack');
  });
});
