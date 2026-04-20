'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
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
import { PageHeader } from '@/components/layout/page-header';
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
      <div className="space-y-6">
        <PageHeader
          density="editorial"
          eyebrow="Prontuário técnico"
          title="Carregando imóvel"
          description="Preparando o resumo operacional, histórico técnico e indicadores de governança."
        />
        <PageSection tone="strong" density="editorial">
          <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
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
    <div className="space-y-6 safe-bottom">
      <PageHeader
        density="editorial"
        eyebrow="Prontuário técnico do imóvel"
        title={property.name}
        description={
          <span className="inline-flex items-start gap-1.5">
            <MapPin className="mt-1 h-3.5 w-3.5 shrink-0" />
            <span>
              {property.address}, {property.city}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Wrench className="h-4 w-4" />
              Nova OS
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/properties/${id}/edit`}>
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </Button>
          </>
        }
      />

      <PageSection
        title="Centro operacional"
        description="Entrada principal para acompanhar saúde técnica, custos, ordens de serviço, inventário e histórico do imóvel."
        tone="strong"
        density="editorial"
        actions={<Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Score de saúde técnica</p>
                  <p className="text-xs leading-5 text-text-secondary">Indicador consolidado para priorizar manutenção e governança.</p>
                </div>
              </div>
              <span className={cn('text-sm font-medium', scoreColor(healthScore))}>{healthLabel}</span>
            </div>
            <ScoreBar score={healthScore} />
          </div>

          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Governança</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Cada OS, documento, garantia e item de inventário alimenta o histórico técnico deste imóvel.
            </p>
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
            />
            <MetricCard
              label="OS abertas"
              value={d.services.requested + d.services.in_progress}
              helper={`${d.services.urgent_open} urgentes`}
              icon={Wrench}
              tone={d.services.urgent_open > 0 ? 'danger' : 'default'}
            />
            <MetricCard
              label="OS concluídas"
              value={d.services.done}
              helper="Histórico executado"
              icon={CheckCircle2}
              tone="success"
            />
            <MetricCard
              label="Itens inventário"
              value={d.inventory.total}
              helper={d.inventory.low_stock > 0 ? `${d.inventory.low_stock} em falta` : 'Tudo ok'}
              icon={Package}
              tone={d.inventory.low_stock > 0 ? 'warning' : 'default'}
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
          <CardContent className="p-6 pt-0">
            <div className="space-y-2">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PropertySummaryCard property={property} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-text-primary">Acesso rápido</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-2 gap-3">
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
