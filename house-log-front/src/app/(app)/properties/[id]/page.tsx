'use client';

import { type ComponentType, use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  FolderKanban,
  GitBranch,
  Home,
  KeyRound,
  Lock,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
  Droplets,
  Layers,
  Paintbrush,
  Grid2x2,
  Umbrella,
  Settings,
} from 'lucide-react';
import { PageSection } from '@/components/layout/page-section';
import { PropertySummaryCard } from '@/components/properties/property-summary-card';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { ActionTile } from '@/components/ui/action-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { apiFetcher, maintenanceApi, propertiesApi, type ServiceOrder } from '@/lib/api';
import { cn, formatCurrency, formatDate, PROPERTY_TYPE_LABELS, SYSTEM_TYPE_LABELS, scoreBg, scoreColor } from '@/lib/utils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full transition-all duration-700', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('w-7 shrink-0 text-right text-sm font-medium tabular-nums', scoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

// ─── system icon map ──────────────────────────────────────────────────────────

const SYSTEM_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  electrical:    Zap,
  plumbing:      Droplets,
  structural:    Layers,
  waterproofing: Umbrella,
  painting:      Paintbrush,
  flooring:      Grid2x2,
  roofing:       Home,
  general:       Settings,
};

const SYSTEM_ACCENT: Record<string, string> = {
  electrical:    'bg-bg-warning text-text-warning',
  plumbing:      'bg-bg-info text-text-info',
  structural:    'bg-bg-subtle text-text-secondary',
  waterproofing: 'bg-bg-info text-text-info',
  painting:      'bg-bg-accent-subtle text-text-accent',
  flooring:      'bg-bg-warning text-text-warning',
  roofing:       'bg-bg-danger text-text-danger',
  general:       'bg-bg-subtle text-text-tertiary',
};

// ─── tab types ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'historico';

// ─── systems tab ─────────────────────────────────────────────────────────────

type SystemSummary = {
  type: string;
  total: number;
  completed: number;
  lastDate: string | null;
};

function SystemsTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useSWR<{ data: ServiceOrder[]; has_more: boolean }>(
    `/properties/${propertyId}/services?limit=100`,
    apiFetcher as (url: string) => Promise<{ data: ServiceOrder[]; has_more: boolean }>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="hl-skeleton h-16 rounded-[var(--radius-xl)]" />
        ))}
      </div>
    );
  }

  const orders = data?.data ?? [];

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="mb-3 h-8 w-8 text-text-tertiary" />
        <p className="text-sm text-text-tertiary">Nenhuma OS registrada ainda.</p>
        <p className="mt-1 text-xs text-text-tertiary">Os sistemas aparecerão conforme as ordens forem criadas.</p>
      </div>
    );
  }

  // Aggregate by system_type
  const map = new Map<string, SystemSummary>();
  for (const o of orders) {
    const existing = map.get(o.system_type) ?? { type: o.system_type, total: 0, completed: 0, lastDate: null };
    existing.total += 1;
    if (o.status === 'completed' || o.status === 'verified') {
      existing.completed += 1;
      const d = o.completed_at ?? o.created_at;
      if (!existing.lastDate || d > existing.lastDate) existing.lastDate = d;
    }
    map.set(o.system_type, existing);
  }

  const systems = [...map.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-2">
      {systems.map((s) => {
        const Icon = SYSTEM_ICONS[s.type] ?? Settings;
        const accentClass = SYSTEM_ACCENT[s.type] ?? 'bg-bg-subtle text-text-tertiary';
        const health = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        return (
          <div
            key={s.type}
            className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4"
          >
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]', accentClass)}>
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {SYSTEM_TYPE_LABELS[s.type] ?? s.type}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                  {s.lastDate ? formatDate(s.lastDate) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', scoreBg(health))}
                    style={{ width: `${health}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-tertiary">
                  {s.completed}/{s.total} OS
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── timeline preview ─────────────────────────────────────────────────────────

function TimelinePreview({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useSWR<{ data: ServiceOrder[] }>(
    `/properties/${propertyId}/services?status=completed&limit=5`,
    apiFetcher as (url: string) => Promise<{ data: ServiceOrder[] }>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
        ))}
      </div>
    );
  }

  const orders = [...(data?.data ?? [])].sort((a, b) => {
    const dA = a.completed_at ?? a.created_at;
    const dB = b.completed_at ?? b.created_at;
    return dB.localeCompare(dA);
  });

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GitBranch className="mb-3 h-8 w-8 text-text-tertiary" />
        <p className="text-sm text-text-tertiary">Nenhum evento registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative space-y-5 pl-7">
        <div className="absolute bottom-0 left-2.5 top-0 w-px bg-border-subtle" />
        {orders.map((o) => {
          const dotColor = o.system_type === 'electrical' ? 'var(--text-warning)'
            : o.system_type === 'plumbing' ? 'var(--interactive-primary-bg)'
            : o.system_type === 'roofing' ? 'var(--text-danger)'
            : 'var(--text-success)';
          return (
            <div key={o.id} className="relative">
              <div
                className="absolute -left-[1.15rem] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg-page)]"
                style={{ background: dotColor }}
              />
              <p className="mb-1 text-xs text-text-tertiary">
                {formatDate(o.completed_at ?? o.created_at)}
              </p>
              <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-text-primary">{o.title}</p>
                    {o.assigned_to_name && (
                      <p className="mt-0.5 text-xs text-text-tertiary">{o.assigned_to_name}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-bg-success px-2.5 py-0.5 text-xs font-medium text-text-success">
                    {SYSTEM_TYPE_LABELS[o.system_type] ?? o.system_type}
                  </span>
                </div>
                {o.cost != null && (
                  <p className="mt-2 text-xs text-text-tertiary">
                    Custo: <span className="text-text-secondary">{formatCurrency(o.cost)}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href={`/properties/${propertyId}/timeline`}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-border-default py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
      >
        <GitBranch className="h-4 w-4" />
        Ver linha do tempo completa
      </Link>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: propData, isLoading: propLoading } = useSWR(['property', id], () => propertiesApi.get(id));
  const { data: dash, isLoading: dashLoading } = useSWR(['dashboard', id], () => propertiesApi.dashboard(id));
  const { data: maintenanceData } = useSWR(['maintenance', id], () => maintenanceApi.list(id));

  if (propLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-4 sm:px-5">
        <div className="hl-skeleton h-44 rounded-[var(--radius-2xl)]" />
        <div className="hl-skeleton h-11 rounded-[var(--radius-xl)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      </div>
    );
  }

  const property = propData?.property;

  if (!property) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-4 sm:px-5">
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Imóvel não encontrado"
          description="O ativo pode ter sido removido ou você pode não ter acesso a este prontuário técnico."
          actions={
            <Button asChild variant="outline">
              <Link href="/properties">Voltar aos imóveis</Link>
            </Button>
          }
          tone="strong"
          density="spacious"
        />
      </div>
    );
  }

  const d = dash;
  const healthScore = d?.health_score ?? property.health_score;
  const healthLabel = healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Bom' : healthScore >= 30 ? 'Atenção' : 'Crítico';
  const totalEvents = (d?.services.total ?? 0);
  const memoriaEmDias = daysSince(property.created_at);
  const openOrders = (d?.services.requested ?? 0) + (d?.services.in_progress ?? 0);
  const urgentOrders = d?.services.urgent_open ?? 0;
  const overdueMaintenance = (maintenanceData?.schedules ?? []).filter((schedule) => schedule.is_overdue);
  const expiringWarranties = d?.warranties_expiring ?? [];
  const currentMonthExpenses = d?.expenses.this_month ?? 0;
  const attentionItems = [
    ...(urgentOrders > 0
      ? [{ tone: 'danger' as const, icon: ShieldAlert, title: `${urgentOrders} OS urgente${urgentOrders > 1 ? 's' : ''}`, description: 'Priorize a triagem e a execucao.' }]
      : []),
    ...(openOrders > 0
      ? [{ tone: 'accent' as const, icon: Wrench, title: `${openOrders} OS aberta${openOrders > 1 ? 's' : ''}`, description: 'Acompanhe solicitacoes e execucoes.' }]
      : []),
    ...(overdueMaintenance.length > 0
      ? [{ tone: 'warning' as const, icon: RefreshCw, title: `${overdueMaintenance.length} manutencao atrasada${overdueMaintenance.length > 1 ? 's' : ''}`, description: 'Revise o plano preventivo.' }]
      : []),
    ...(expiringWarranties.length > 0
      ? [{ tone: 'warning' as const, icon: ShieldCheck, title: `${expiringWarranties.length} garantia${expiringWarranties.length > 1 ? 's' : ''} vencendo`, description: 'Verifique itens dentro de 30 dias.' }]
      : []),
    ...(currentMonthExpenses > 0
      ? [{ tone: 'success' as const, icon: BarChart3, title: formatCurrency(currentMonthExpenses), description: 'Despesa registrada neste mes.' }]
      : []),
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Visão geral' },
    { id: 'historico', label: 'Histórico' },
  ];

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">

      {/* ── EDITORIAL HERO ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface-base)]">

        {/* Cover photo or gradient backdrop */}
        {property.cover_url ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${property.cover_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(11,19,38,0.60) 0%, rgba(11,19,38,0.75) 50%, rgba(11,19,38,0.96) 100%)' }} />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(184,195,255,0.06)] via-transparent to-[rgba(78,222,163,0.04)]" />
        )}

        <div className="relative z-10 px-4 pb-0 pt-4 sm:px-6 sm:pt-5 md:px-7 md:pt-6">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Link href="/properties" className="hover:text-text-secondary transition-colors">
                Meus imóveis
              </Link>
              <span>/</span>
              <Badge variant="secondary" className="text-xs">
                {PROPERTY_TYPE_LABELS[property.type]}
              </Badge>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/properties/${id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Wrench className="h-3.5 w-3.5" />
                Nova OS
              </Button>
            </div>
          </div>

          {/* Property name */}
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
              Memória técnica viva
            </p>
            <h1 className="mt-2 text-3xl font-light leading-tight tracking-tight text-text-primary md:text-4xl">
              {property.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-start gap-x-1.5 gap-y-0.5 text-sm text-text-secondary">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              <span className="min-w-0 break-words">{property.address}, {property.city}</span>
              {(property.area_m2 || property.year_built) && (
                <span className="shrink-0 text-text-tertiary">
                  {property.area_m2 ? `· ${property.area_m2} m²` : ''}
                  {property.year_built ? ` · ${property.year_built}` : ''}
                </span>
              )}
            </p>
          </div>

          {/* Stats trio + health */}
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] border border-border-subtle bg-border-subtle sm:grid-cols-4">
            {/* Saúde */}
            <div className="flex flex-col gap-1 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Saúde</p>
              <div className="flex items-baseline gap-1">
                <span className={cn('text-xl font-light tabular-nums sm:text-2xl', scoreColor(healthScore))}>
                  {healthScore}
                </span>
                <span className="text-xs text-text-tertiary">/100</span>
              </div>
              <p className="text-[10px] text-text-tertiary">{healthLabel}</p>
            </div>

            {/* Dias de memória */}
            <div className="flex flex-col gap-1 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Memória</p>
              <span className="text-xl font-light tabular-nums text-text-primary sm:text-2xl">
                {memoriaEmDias.toLocaleString('pt-BR')}
              </span>
              <p className="text-[10px] text-text-tertiary">dias rastreados</p>
            </div>

            {/* Eventos */}
            <div className="flex flex-col gap-1 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Eventos</p>
              <span className="text-xl font-light tabular-nums text-text-primary sm:text-2xl">
                {totalEvents}
              </span>
              <p className="text-[10px] text-text-tertiary">OS registradas</p>
            </div>

            {/* Health bar visual */}
            <div className="flex flex-col justify-between gap-1.5 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Estado técnico</p>
              <ScoreBar score={healthScore} />
            </div>
          </div>

          {/* Tabs */}
          <div className="-mx-4 mt-5 flex border-t border-border-subtle px-0 sm:-mx-6 md:-mx-7">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative min-h-11 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none',
                  activeTab === tab.id
                    ? 'text-text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--border-focus)]'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB: VISÃO GERAL ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics */}
          <PageSection
            title="Centro operacional"
            description="Leitura rápida do estado técnico e financeiro do ativo."
            tone="strong"
            density="editorial"
          >
            {dashLoading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
                ))}
              </div>
            ) : d ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Despesa mensal"
                  value={formatCurrency(d.expenses.this_month ?? 0)}
                  helper="Mês atual"
                  icon={BarChart3}
                  density="compact"
                />
                <MetricCard
                  label="OS abertas"
                  value={d.services.requested + d.services.in_progress}
                  helper={`${d.services.urgent_open} urgentes`}
                  icon={Wrench}
                  tone={d.services.urgent_open > 0 ? 'danger' : 'default'}
                  density="compact"
                />
                <MetricCard
                  label="OS concluídas"
                  value={d.services.done}
                  helper="Histórico executado"
                  icon={CheckCircle2}
                  tone="success"
                  density="compact"
                />
                <MetricCard
                  label="Itens inventário"
                  value={d.inventory.total}
                  helper={d.inventory.low_stock > 0 ? `${d.inventory.low_stock} em falta` : 'Tudo ok'}
                  icon={Package}
                  tone={d.inventory.low_stock > 0 ? 'warning' : 'default'}
                  density="compact"
                />
              </div>
            ) : null}
          </PageSection>

          <PageSection
            title="Atenção agora"
            description="Sinais operacionais que merecem revisão antes de navegar pelo prontuário."
            tone="strong"
            density="editorial"
          >
            {attentionItems.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  const href =
                    item.icon === BarChart3
                      ? `/properties/${id}/financial`
                      : item.icon === RefreshCw
                        ? `/properties/${id}/maintenance`
                        : item.icon === ShieldCheck
                          ? `/properties/${id}/inventory`
                          : `/properties/${id}/services`;

                  return (
                    <Link
                      key={`${item.title}-${item.description}`}
                      href={href}
                      className={cn(
                        'flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                        item.tone === 'danger' && 'bg-bg-danger',
                        item.tone === 'warning' && 'bg-bg-warning',
                        item.tone === 'success' && 'bg-bg-success',
                        item.tone === 'accent' && 'bg-bg-accent-subtle'
                      )}
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          item.tone === 'danger' && 'text-text-danger',
                          item.tone === 'warning' && 'text-text-warning',
                          item.tone === 'success' && 'text-text-success',
                          item.tone === 'accent' && 'text-text-accent'
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-primary">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-text-secondary">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] bg-bg-success px-4 py-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-text-success" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">Imóvel sem alertas ativos</span>
                  <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
                    Nenhum sinal operacional crítico identificado. Continue monitorando pelo prontuário técnico.
                  </span>
                </span>
              </div>
            )}
          </PageSection>

          {/* Warranties expiring */}
          {d?.warranties_expiring && d.warranties_expiring.length > 0 && (
            <PageSection
              title="Garantias a vencer"
              description="Itens com vencimento nos próximos 30 dias."
              tone="strong"
              density="editorial"
              actions={<ShieldAlert className="h-4 w-4 text-text-warning" />}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {d.warranties_expiring.map((warranty) => (
                  <Link
                    key={warranty.id}
                    href={`/properties/${id}/inventory`}
                    className="flex items-center justify-between rounded-[var(--radius-lg)] bg-bg-warning px-3 py-3 transition-colors hover:bg-bg-warning-emphasis focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.98]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ShieldCheck
                        className={cn('h-4 w-4 shrink-0', warranty.days_left <= 7 ? 'text-text-danger' : 'text-text-warning')}
                      />
                      <span className="truncate text-sm font-medium text-text-primary">{warranty.name}</span>
                    </div>
                    <span className={cn('ml-3 shrink-0 text-xs font-medium', warranty.days_left <= 7 ? 'text-text-danger' : 'text-text-warning')}>
                      {warranty.days_left === 0 ? 'Vence hoje' : `${warranty.days_left}d`}
                    </span>
                  </Link>
                ))}
              </div>
            </PageSection>
          )}

          {/* Summary card + gestão técnica */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <PropertySummaryCard property={property} className="h-full" />

            <PageSection
              title="Gestão técnica"
              description="Acesso direto a todos os módulos do imóvel."
              tone="surface"
              density="editorial"
            >
              <div className="space-y-4">
                {/* Prontuário técnico — memória técnica e documentação do imóvel */}
                <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-[var(--surface-base)] p-3">
                  <div className="mb-2.5 flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      Prontuário técnico
                    </p>
                    <span className="flex-1 border-t border-border-subtle" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {[
                      { href: `/properties/${id}/warranties`,  icon: ShieldCheck,    label: 'Garantias',  description: 'Contratos e prazos',  tone: 'success' as const },
                      { href: `/properties/${id}/renovations`, icon: FolderKanban,   label: 'Reformas',   description: 'Obras e intervenções', tone: 'accent'  as const },
                      { href: `/properties/${id}/handover`,    icon: ClipboardCheck, label: 'Handover',   description: 'Entrega técnica',      tone: 'muted'   as const },
                      { href: `/properties/${id}/documents`,   icon: FileText,       label: 'Documentos', description: 'Arquivos do imóvel',   tone: 'muted'   as const },
                      { href: `/properties/${id}/inventory`,   icon: Package,        label: 'Inventário', description: 'Itens e sistemas',     tone: 'warning' as const },
                    ].map(({ href, icon, label, description, tone }) => (
                      <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
                    ))}
                  </div>
                </div>

                {/* Operacional — execução e acompanhamento */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    Operacional
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { href: `/properties/${id}/services`,    icon: Wrench,    label: 'OS',         description: 'Ordens de serviço',   tone: 'accent'  as const },
                      { href: `/properties/${id}/maintenance`, icon: RefreshCw, label: 'Manutenção', description: 'Plano preventivo',    tone: 'warning' as const },
                      { href: `/properties/${id}/rooms`,       icon: Home,      label: 'Cômodos',    description: 'Ambientes do imóvel', tone: 'default' as const },
                    ].map(({ href, icon, label, description, tone }) => (
                      <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
                    ))}
                  </div>
                </div>

                {/* Financeiro — custos, despesas e relatórios */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    Financeiro
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: `/properties/${id}/financial`, icon: BarChart3, label: 'Financeiro', description: 'Despesas e custos',   tone: 'success' as const },
                      { href: `/properties/${id}/report`,    icon: Activity,  label: 'Relatório',  description: 'Relatório do imóvel', tone: 'accent'  as const },
                    ].map(({ href, icon, label, description, tone }) => (
                      <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
                    ))}
                  </div>
                </div>
              </div>
            </PageSection>
          </div>

          {/* Administração do imóvel — módulos de configuração e controle de acesso */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                Administração do imóvel
              </p>
              <span className="flex-1 border-t border-border-subtle" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { href: `/properties/${id}/team`,        icon: Users,    label: 'Equipe',       description: 'Responsáveis e colaboradores', tone: 'muted' as const },
                { href: `/properties/${id}/access`,      icon: KeyRound, label: 'Acessos',      description: 'Permissões e convites',        tone: 'muted' as const },
                { href: `/properties/${id}/credentials`, icon: Lock,     label: 'Credenciais',  description: 'Acessos técnicos seguros',     tone: 'muted' as const },
                { href: `/properties/${id}/map`,         icon: Compass,  label: 'Mapa técnico', description: 'Pontos e sistemas do imóvel',  tone: 'muted' as const },
              ].map(({ href, icon, label, description, tone }) => (
                <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: HISTÓRICO ───────────────────────────────────────────────── */}
      {activeTab === 'historico' && (
        <div className="mx-auto max-w-2xl space-y-8 pb-8">
          <div className="space-y-4">
            <p className="text-sm text-text-tertiary">
              Últimas OS concluídas · <Link href={`/properties/${id}/timeline`} className="text-text-accent hover:underline">Ver linha do tempo completa</Link>
            </p>
            <TimelinePreview propertyId={id} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-secondary">Saúde por sistema</p>
              <span className="flex-1 border-t border-border-subtle" aria-hidden="true" />
            </div>
            <p className="text-xs text-text-tertiary">Estado técnico derivado das OS registradas.</p>
            <SystemsTab propertyId={id} />
          </div>
        </div>
      )}

      <ServiceOrderCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        propertyId={id}
        onCreated={(orderId) => router.push(`/properties/${id}/services/${orderId}`)}
      />
    </div>
  );
}
