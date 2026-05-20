'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState as UiEmptyState } from '@/components/ui/empty-state';
import type { PropertyDashboard } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type DashboardProps = {
  propertyId: string;
  dashboard: PropertyDashboard | undefined;
  isLoading: boolean;
  hasError?: boolean;
  onRetry?: () => void;
};

type RiskTone = 'success' | 'warning' | 'danger' | 'accent' | 'default';

type RiskItem = {
  label: string;
  value: number;
  tone: RiskTone;
};

type PreventiveAlert = PropertyDashboard['preventive_alerts'][number];
type SeverityFilter = 'all' | PreventiveAlert['severity'];

function toneClasses(tone: RiskTone): string {
  if (tone === 'success') return 'border-[color-mix(in_srgb,var(--hl-success)_24%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-success)_8%,var(--hl-surface))] text-hl-success';
  if (tone === 'warning') return 'border-[color-mix(in_srgb,var(--hl-warning)_24%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-warning)_9%,var(--hl-surface))] text-hl-warning';
  if (tone === 'danger') return 'border-[color-mix(in_srgb,var(--hl-danger)_24%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-danger)_9%,var(--hl-surface))] text-hl-danger';
  if (tone === 'accent') return 'border-[color-mix(in_srgb,var(--hl-accent)_22%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-accent)_8%,var(--hl-surface))] text-hl-accent';
  return 'border-hl-border bg-hl-surface-soft text-hl-text';
}

function healthLabel(score: number): string {
  if (score >= 85) return 'Estavel';
  if (score >= 70) return 'Monitorar';
  if (score >= 50) return 'Atencao';
  return 'Critico';
}

function healthTone(score: number): RiskTone {
  if (score >= 85) return 'success';
  if (score >= 70) return 'accent';
  if (score >= 50) return 'warning';
  return 'danger';
}

function buildRisks(dashboard: PropertyDashboard): RiskItem[] {
  const pendingDocuments = dashboard.documents.pending_review + dashboard.documents.failed_processing;
  const openOrders = dashboard.services.requested + dashboard.services.in_progress;
  const items: RiskItem[] = [
    {
      label: 'OS urgentes',
      value: dashboard.services.urgent_open,
      tone: dashboard.services.urgent_open > 0 ? 'danger' : 'default',
    },
    {
      label: 'Documentos pendentes',
      value: pendingDocuments,
      tone: pendingDocuments > 0 ? 'warning' : 'default',
    },
    {
      label: 'Garantias vencendo',
      value: dashboard.warranties.expiring_soon,
      tone: dashboard.warranties.expiring_soon > 0 ? 'warning' : 'default',
    },
    {
      label: 'Manutencoes atrasadas',
      value: dashboard.maintenance.overdue,
      tone: dashboard.maintenance.overdue > 0 ? 'danger' : 'default',
    },
    {
      label: 'OS abertas',
      value: openOrders,
      tone: openOrders > 0 ? 'accent' : 'default',
    },
  ];
  return items;
}

function severityLabel(severity: PreventiveAlert['severity']): string {
  if (severity === 'critical') return 'Critico';
  if (severity === 'warning') return 'Atencao';
  return 'Info';
}

function severityClasses(severity: PreventiveAlert['severity']): string {
  if (severity === 'critical') return 'border-[color-mix(in_srgb,var(--hl-danger)_24%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-danger)_8%,var(--hl-surface))] text-hl-danger';
  if (severity === 'warning') return 'border-[color-mix(in_srgb,var(--hl-warning)_24%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-warning)_9%,var(--hl-surface))] text-hl-warning';
  return 'border-[color-mix(in_srgb,var(--hl-info)_20%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-info)_7%,var(--hl-surface))] text-hl-info';
}

function alertHref(propertyId: string, alert: PreventiveAlert): string {
  if (alert.action_href.startsWith('/properties/')) return alert.action_href;
  return `/properties/${propertyId}`;
}

export function EmptyState({ propertyId }: { propertyId: string }) {
  return (
    <div className="rounded-[var(--hl-radius-lg)] border border-[color-mix(in_srgb,var(--hl-success)_20%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-success)_7%,var(--hl-surface))] px-4 py-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--hl-radius-md)] bg-hl-surface text-hl-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-hl-text">Imovel sem alertas preventivos</span>
          <span className="mt-1 block text-sm leading-5 text-hl-text-muted">
            Garantias, manutencoes, OS, documentos essenciais e handover estao sem pendencias ativas.
          </span>
          <Link href={`/properties/${propertyId}/timeline`} className="mt-3 inline-flex text-sm font-medium text-hl-accent hover:underline">
            Ver memoria tecnica
          </Link>
        </span>
      </div>
    </div>
  );
}

export function WarrantyAlertCard({ propertyId, alert }: { propertyId: string; alert: PreventiveAlert }) {
  const isExpired = alert.type === 'warranty_expired';
  return (
    <Link
      href={alertHref(propertyId, alert)}
      className={cn('block rounded-[var(--hl-radius-lg)] border p-3 transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]', severityClasses(alert.severity))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-hl-text">{alert.title}</p>
          <p className="mt-1 text-sm leading-5 text-hl-text-muted">{alert.description}</p>
        </div>
        {isExpired ? <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em]">{severityLabel(alert.severity)}</p>
    </Link>
  );
}

export function MaintenanceAlertCard({ propertyId, alert }: { propertyId: string; alert: PreventiveAlert }) {
  return (
    <Link
      href={alertHref(propertyId, alert)}
      className={cn('block rounded-[var(--hl-radius-lg)] border p-3 transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]', severityClasses(alert.severity))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-hl-text">{alert.title}</p>
          <p className="mt-1 text-sm leading-5 text-hl-text-muted">{alert.description}</p>
        </div>
        <RefreshCw className="h-5 w-5 shrink-0" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em]">{severityLabel(alert.severity)}</p>
    </Link>
  );
}

function GenericAlertCard({ propertyId, alert }: { propertyId: string; alert: PreventiveAlert }) {
  const Icon = alert.type === 'stale_service_order'
    ? Clock
    : alert.type === 'handover_pending'
      ? ClipboardCheck
      : FileText;

  return (
    <Link
      href={alertHref(propertyId, alert)}
      className={cn('block rounded-[var(--hl-radius-lg)] border p-3 transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]', severityClasses(alert.severity))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-hl-text">{alert.title}</p>
          <p className="mt-1 text-sm leading-5 text-hl-text-muted">{alert.description}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em]">{severityLabel(alert.severity)}</p>
    </Link>
  );
}

function AlertCard({ propertyId, alert }: { propertyId: string; alert: PreventiveAlert }) {
  if (alert.type === 'warranty_expiring' || alert.type === 'warranty_expired') {
    return <WarrantyAlertCard propertyId={propertyId} alert={alert} />;
  }
  if (alert.type === 'maintenance_overdue') {
    return <MaintenanceAlertCard propertyId={propertyId} alert={alert} />;
  }
  return <GenericAlertCard propertyId={propertyId} alert={alert} />;
}

export function AlertCenter({ propertyId, alerts }: { propertyId: string; alerts: PreventiveAlert[] }) {
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter((alert) => alert.severity === 'critical').length,
    warning: alerts.filter((alert) => alert.severity === 'warning').length,
    info: alerts.filter((alert) => alert.severity === 'info').length,
  }), [alerts]);
  const filteredAlerts = useMemo(
    () => severity === 'all' ? alerts : alerts.filter((alert) => alert.severity === severity),
    [alerts, severity]
  );
  const filters: Array<{ id: SeverityFilter; label: string; value: number }> = [
    { id: 'all', label: 'Todos', value: counts.all },
    { id: 'critical', label: 'Criticos', value: counts.critical },
    { id: 'warning', label: 'Atencao', value: counts.warning },
    { id: 'info', label: 'Info', value: counts.info },
  ];

  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Alertas preventivos</p>
          <h3 className="mt-1 text-lg font-semibold text-hl-text">{counts.all > 0 ? `${counts.all} alerta(s) ativo(s)` : 'Operacao limpa'}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar alertas por severidade">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={severity === filter.id}
              onClick={() => setSeverity(filter.id)}
              className={cn(
                'rounded-[var(--hl-radius-md)] border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                severity === filter.id
                  ? 'border-hl-accent bg-hl-accent-muted text-hl-accent'
                  : 'border-hl-border bg-hl-surface text-hl-text-muted hover:bg-hl-surface-muted hover:text-hl-text'
              )}
            >
              {filter.label} {filter.value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {counts.all === 0 ? (
          <EmptyState propertyId={propertyId} />
        ) : filteredAlerts.length > 0 ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {filteredAlerts.map((alert) => <AlertCard key={alert.id} propertyId={propertyId} alert={alert} />)}
          </div>
        ) : (
          <p className="rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-3 text-sm text-hl-text-muted">
            Nenhum alerta nesta severidade.
          </p>
        )}
      </div>
    </section>
  );
}

function eventHref(propertyId: string, event: NonNullable<PropertyDashboard['last_event']>): string {
  if (event.entity_type === 'service_order') return `/properties/${propertyId}/services/${event.entity_id}`;
  if (event.entity_type === 'document') return `/properties/${propertyId}?tab=documents`;
  if (event.entity_type === 'warranty') return `/properties/${propertyId}?tab=warranties`;
  if (event.entity_type === 'inventory_item') return `/properties/${propertyId}?tab=inventory`;
  if (event.entity_type === 'handover_package') return `/properties/${propertyId}?tab=handover`;
  return `/properties/${propertyId}?tab=tickets`;
}

export function TechnicalHealthCard({ dashboard }: { dashboard: PropertyDashboard }) {
  const score = dashboard.health_score;
  const tone = healthTone(score);
  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Saude tecnica</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-4xl font-semibold leading-none tabular-nums text-hl-text">{score}</span>
            <span className="pb-1 text-xs text-hl-text-muted">/100</span>
          </div>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', toneClasses(tone))}>{healthLabel(score)}</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-hl-surface-soft">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'success' && 'bg-hl-success',
            tone === 'accent' && 'bg-hl-accent',
            tone === 'warning' && 'bg-hl-warning',
            tone === 'danger' && 'bg-hl-danger'
          )}
          style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-hl-text-muted">
        Indicador consolidado do prontuario, combinado com riscos operacionais visiveis nesta tela.
      </p>
    </section>
  );
}

export function RiskSummaryCard({ propertyId, dashboard }: { propertyId: string; dashboard: PropertyDashboard }) {
  const risks = buildRisks(dashboard);
  const hrefByLabel: Record<string, string> = {
    'OS urgentes': `/properties/${propertyId}?tab=services`,
    'Documentos pendentes': `/properties/${propertyId}?tab=documents`,
    'Garantias vencendo': `/properties/${propertyId}?tab=warranties`,
    'Manutencoes atrasadas': `/properties/${propertyId}/maintenance`,
    'OS abertas': `/properties/${propertyId}?tab=services`,
  };
  const activeRisks = risks.filter((risk) => risk.value > 0).length;

  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Riscos executivos</p>
          <p className="mt-1 text-sm text-hl-text-muted">{activeRisks > 0 ? `${activeRisks} ponto(s) para revisar` : 'Nenhum alerta ativo'}</p>
        </div>
        {activeRisks > 0 ? <ShieldAlert className="h-5 w-5 text-hl-warning" /> : <CheckCircle2 className="h-5 w-5 text-hl-success" />}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {risks.map((risk) => (
          <Link
            key={risk.label}
            href={hrefByLabel[risk.label]}
            className={cn('flex items-center justify-between rounded-[var(--hl-radius-md)] border px-3 py-2 text-sm transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]', toneClasses(risk.tone))}
          >
            <span className="font-medium text-hl-text">{risk.label}</span>
            <span className="tabular-nums">{risk.value}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function WarrantySummaryCard({ propertyId, dashboard }: { propertyId: string; dashboard: PropertyDashboard }) {
  const expiring = dashboard.warranties_expiring.slice(0, 3);
  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Garantias</p>
          <p className="mt-1 text-sm text-hl-text-muted">{dashboard.warranties.active} ativas, {dashboard.warranties.expiring_soon} vencendo</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-hl-success" />
      </div>
      {expiring.length > 0 ? (
        <div className="mt-4 space-y-2">
          {expiring.map((warranty) => (
            <Link key={`${warranty.source ?? 'item'}-${warranty.id}`} href={`/properties/${propertyId}?tab=warranties`} className="flex items-center justify-between gap-3 rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-2 text-sm hover:bg-hl-surface-muted">
              <span className="min-w-0 truncate font-medium text-hl-text">{warranty.name}</span>
              <span className="shrink-0 text-xs font-semibold text-hl-warning">{warranty.days_left === 0 ? 'hoje' : `${warranty.days_left}d`}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-3 text-sm text-hl-text-muted">Nenhuma garantia vencendo nos proximos 30 dias.</p>
      )}
    </section>
  );
}

export function PendingDocumentsCard({ propertyId, dashboard }: { propertyId: string; dashboard: PropertyDashboard }) {
  const pending = dashboard.documents.pending_review + dashboard.documents.failed_processing;
  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Documentos</p>
          <p className="mt-1 text-sm text-hl-text-muted">{dashboard.documents.total} arquivo(s) no prontuario</p>
        </div>
        <FileText className="h-5 w-5 text-hl-accent" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniKpi label="Pendentes" value={pending} tone={pending > 0 ? 'warning' : 'default'} />
        <MiniKpi label="Vencendo" value={dashboard.documents.expiring_soon} tone={dashboard.documents.expiring_soon > 0 ? 'warning' : 'default'} />
        <MiniKpi label="Vencidos" value={dashboard.documents.expired} tone={dashboard.documents.expired > 0 ? 'danger' : 'default'} />
      </div>
      <Button className="mt-4 w-full" variant="outline" size="sm" asChild>
        <Link href={`/properties/${propertyId}?tab=documents`}>Abrir documentos</Link>
      </Button>
    </section>
  );
}

export function RecentActivityCard({ propertyId, dashboard }: { propertyId: string; dashboard: PropertyDashboard }) {
  const event = dashboard.last_event;
  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Ultimo evento tecnico</p>
          <p className="mt-1 text-sm text-hl-text-muted">Memoria recente do ativo</p>
        </div>
        <Activity className="h-5 w-5 text-hl-accent" />
      </div>
      {event ? (
        <Link href={eventHref(propertyId, event)} className="mt-4 flex items-center justify-between gap-3 rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-3 hover:bg-hl-surface-muted">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-hl-text">{event.title}</span>
            <span className="mt-1 block text-xs text-hl-text-muted">{formatDate(event.at)}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-hl-text-muted" />
        </Link>
      ) : (
        <p className="mt-4 rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-3 text-sm text-hl-text-muted">Nenhum evento tecnico consolidado ainda.</p>
      )}
    </section>
  );
}

function MiniKpi({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: RiskTone }) {
  return (
    <div className={cn('rounded-[var(--hl-radius-md)] border px-2.5 py-2', toneClasses(tone))}>
      <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.06em] text-hl-text-muted">{label}</p>
    </div>
  );
}

export function DashboardEmptyState({ propertyId }: { propertyId: string }) {
  return (
    <UiEmptyState
      icon={<Activity className="h-6 w-6" />}
      title="Dashboard em formacao"
      description="Cadastre documentos, garantias, inventario e OS para formar a leitura executiva do imovel."
      actions={
        <Button asChild variant="outline">
          <Link href={`/properties/${propertyId}?tab=documents`}>Comecar por documentos</Link>
        </Button>
      }
      tone="strong"
    />
  );
}

export function ExecutivePropertyDashboard({ propertyId, dashboard, isLoading, hasError, onRetry }: DashboardProps) {
  if (isLoading) {
    return (
      <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Dashboard executivo</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
          <div className="hl-skeleton h-40 rounded-[var(--hl-radius-lg)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, index) => <div key={index} className="hl-skeleton h-32 rounded-[var(--hl-radius-lg)]" />)}
          </div>
        </div>
      </section>
    );
  }

  if (hasError) {
    return (
      <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
        <UiEmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Nao foi possivel carregar o dashboard"
          description="Os indicadores executivos permanecem protegidos. Tente recarregar os dados."
          actions={onRetry ? <Button variant="outline" onClick={onRetry}>Tentar novamente</Button> : undefined}
          tone="strong"
        />
      </section>
    );
  }

  if (!dashboard) return <DashboardEmptyState propertyId={propertyId} />;

  const hasData =
    dashboard.documents.total +
    dashboard.services.total +
    dashboard.inventory.total +
    dashboard.warranties.total +
    dashboard.handover.total >
    0;

  return (
    <section className="space-y-4 rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface-soft p-3 shadow-hl-subtle sm:p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Dashboard executivo</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal text-hl-text">Visao de saude, riscos e pendencias</h2>
        </div>
        <Link href={`/properties/${propertyId}/timeline`} className="inline-flex items-center gap-2 text-sm font-medium text-hl-accent hover:underline">
          Ver memoria tecnica
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {!hasData ? (
        <DashboardEmptyState propertyId={propertyId} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)]">
          <TechnicalHealthCard dashboard={dashboard} />
          <div className="grid gap-3 lg:grid-cols-2">
            <RiskSummaryCard propertyId={propertyId} dashboard={dashboard} />
            <PendingDocumentsCard propertyId={propertyId} dashboard={dashboard} />
            <WarrantySummaryCard propertyId={propertyId} dashboard={dashboard} />
            <RecentActivityCard propertyId={propertyId} dashboard={dashboard} />
          </div>
        </div>
      )}

      <AlertCenter propertyId={propertyId} alerts={dashboard.preventive_alerts ?? []} />

      <div className="grid gap-2 sm:grid-cols-4">
        <MiniKpi label="OS abertas" value={dashboard.services.requested + dashboard.services.in_progress} tone={dashboard.services.urgent_open > 0 ? 'danger' : 'accent'} />
        <MiniKpi label="OS urgentes" value={dashboard.services.urgent_open} tone={dashboard.services.urgent_open > 0 ? 'danger' : 'default'} />
        <MiniKpi label="Inventario" value={dashboard.inventory.total} tone={dashboard.inventory.low_stock > 0 ? 'warning' : 'default'} />
        <MiniKpi label="Dossie" value={dashboard.handover.dossier_status === 'issued' ? 'Emitido' : 'Pendente'} tone={dashboard.handover.dossier_status === 'issued' ? 'success' : 'warning'} />
      </div>
    </section>
  );
}
