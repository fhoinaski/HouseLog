'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  GitBranch,
  Home,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { PageSection } from '@/components/layout/page-section';
import { PropertySummaryCard } from '@/components/properties/property-summary-card';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { ActionTile } from '@/components/ui/action-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { cn, formatCurrency, PROPERTY_TYPE_LABELS, scoreBg, scoreColor } from '@/lib/utils';

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('w-8 text-right text-sm font-medium', scoreColor(score))}>{score}</span>
    </div>
  );
}

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: propData, isLoading: propLoading } = useSWR(['property', id], () => propertiesApi.get(id));

  const { data: dash, isLoading: dashLoading } = useSWR(['dashboard', id], () => propertiesApi.dashboard(id));

  if (propLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-4 safe-bottom">
        <Card variant="raised" density="comfortable">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="hl-skeleton h-3 w-40 rounded" />
                <div className="hl-skeleton h-7 w-64 max-w-full rounded" />
                <div className="hl-skeleton h-4 w-full max-w-lg rounded" />
              </div>
              <div className="flex gap-2">
                <div className="hl-skeleton h-11 w-28 rounded-[var(--radius-md)]" />
                <div className="hl-skeleton h-11 w-24 rounded-[var(--radius-md)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <PageSection tone="strong" density="comfortable">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
            <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        </PageSection>
      </div>
    );
  }

  const property = propData?.property;
  if (!property) return <div className="py-20 text-center text-text-secondary">Imóvel não encontrado</div>;

  const d = dash;
  const healthScore = d?.health_score ?? property.health_score;
  const healthLabel = healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Bom' : healthScore >= 30 ? 'Atenção' : 'Crítico';

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 safe-bottom">
      <Card variant="raised" density="comfortable" className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                  Prontu&aacute;rio t&eacute;cnico
                </span>
              </div>
              <h1 className="text-2xl font-medium leading-tight text-text-primary sm:text-3xl">{property.name}</h1>
              <p className="mt-2 flex items-start gap-1.5 text-sm leading-6 text-text-secondary">
                <MapPin className="mt-1 h-3.5 w-3.5 shrink-0" />
                <span>
                  {property.address}, {property.city}
                </span>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_auto] lg:min-w-[20rem] lg:grid-cols-1">
              <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    Sa&uacute;de t&eacute;cnica
                  </span>
                  <span className={cn('text-sm font-medium', scoreColor(healthScore))}>{healthLabel}</span>
                </div>
                <ScoreBar score={healthScore} />
              </div>

              <div className="flex gap-2 sm:justify-end lg:justify-start">
                <Button className="flex-1 sm:flex-none" onClick={() => setCreateOpen(true)}>
                  <Wrench className="h-4 w-4" />
                  Nova OS
                </Button>
                <Button variant="outline" className="flex-1 sm:flex-none" asChild>
                  <Link href={`/properties/${id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PageSection
        title="Centro operacional"
        description={'Leitura compacta do estado t\u00e9cnico, financeiro e operacional do im\u00f3vel.'}
        tone="strong"
        density="comfortable"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
                <Activity className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{'Prontu\u00e1rio vivo'}</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                  {'Ordens de servi\u00e7o, documentos, garantias e invent\u00e1rio alimentam uma linha t\u00e9cnica \u00fanica para decis\u00e3o e auditoria.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-strong)] text-text-secondary">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{'Governan\u00e7a do ativo'}</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {PROPERTY_TYPE_LABELS[property.type]} com {property.floors} pavimento(s) registrado(s) no HouseLog.
                </p>
              </div>
            </div>
          </div>
        </div>

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

      {d?.warranties_expiring && d.warranties_expiring.length > 0 && (
        <Card className="border-border-warning bg-bg-warning">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-text-warning">
              <ShieldAlert className="h-4 w-4 text-text-warning" />
              Garantias a vencer (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="grid gap-2 sm:grid-cols-2">
              {d.warranties_expiring.map((w) => (
                <Link
                  key={w.id}
                  href={`/properties/${id}/inventory`}
                  className="flex items-center justify-between rounded-lg border-half border-border-warning bg-bg-surface px-3 py-2 transition-colors hover:bg-bg-warning active:scale-[0.98]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ShieldCheck
                      className={cn('h-4 w-4 shrink-0', w.days_left <= 7 ? 'text-text-danger' : 'text-text-warning')}
                    />
                    <span className="truncate text-sm font-medium text-text-primary">{w.name}</span>
                  </div>
                  <span className={cn('ml-3 shrink-0 text-xs font-medium', w.days_left <= 7 ? 'text-text-danger' : 'text-text-warning')}>
                    {w.days_left === 0 ? 'Vence hoje' : `${w.days_left}d`}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <PropertySummaryCard property={property} className="h-full" />

        <Card variant="tonal" density="comfortable" className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-text-primary">Acesso rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {[
                { href: `/properties/${id}/rooms`, icon: Home, label: 'Cômodos', tone: 'default' as const },
                { href: `/properties/${id}/inventory`, icon: Package, label: 'Inventário', tone: 'warning' as const },
                { href: `/properties/${id}/services`, icon: Wrench, label: 'Serviços', tone: 'accent' as const },
                { href: `/properties/${id}/timeline`, icon: GitBranch, label: 'Timeline', tone: 'muted' as const },
                { href: `/properties/${id}/maintenance`, icon: RefreshCw, label: 'Manutenção', tone: 'warning' as const },
                { href: `/properties/${id}/documents`, icon: FileText, label: 'Documentos', tone: 'muted' as const },
                { href: `/properties/${id}/financial`, icon: BarChart3, label: 'Financeiro', tone: 'success' as const },
                { href: `/properties/${id}/report`, icon: Activity, label: 'Relatório', tone: 'accent' as const },
              ].map(({ href, icon, label, tone }) => (
                <ActionTile
                  key={href}
                  href={href}
                  icon={icon}
                  label={label}
                  tone={tone}
                  density="compact"
                  aria-label={`Abrir ${label}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ServiceOrderCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        propertyId={id}
        onCreated={(orderId) => router.push(`/properties/${id}/services/${orderId}`)}
      />
    </div>
  );
}
