'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
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
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { PropertySummaryCard } from '@/components/properties/property-summary-card';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { ActionTile } from '@/components/ui/action-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { propertiesApi } from '@/lib/api';
import { cn, formatCurrency, PROPERTY_TYPE_LABELS, scoreBg, scoreColor } from '@/lib/utils';

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('w-7 text-right text-sm font-medium tabular-nums', scoreColor(score))}>{score}</span>
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
      <div className="mx-auto max-w-[1180px] space-y-6 safe-bottom">
        <PageHeader
          density="editorial"
          eyebrow="Prontuario tecnico"
          title="Carregando imovel"
          description="Preparando o prontuario tecnico e a leitura operacional do ativo."
          actions={
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="hl-skeleton h-11 w-full rounded-[var(--radius-md)] sm:w-28" />
              <div className="hl-skeleton h-11 w-full rounded-[var(--radius-md)] sm:w-24" />
            </div>
          }
        />

        <PageSection tone="strong" density="editorial">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
            <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        </PageSection>
      </div>
    );
  }

  const property = propData?.property;

  if (!property) {
    return (
      <div className="mx-auto max-w-[760px] safe-bottom">
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Imovel nao encontrado"
          description="O ativo pode ter sido removido ou voce pode nao ter acesso a este prontuario tecnico."
          actions={
            <Button asChild variant="outline">
              <Link href="/properties">Voltar aos imoveis</Link>
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
  const healthLabel = healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Bom' : healthScore >= 30 ? 'Atencao' : 'Critico';

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 safe-bottom">
      <PageHeader
        density="editorial"
        eyebrow="Prontuario tecnico"
        title={property.name}
        description={
          <span className="flex items-start gap-1.5">
            <MapPin className="mt-1 h-3.5 w-3.5 shrink-0" />
            <span>
              {property.address}, {property.city}
            </span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)}>
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

      <PageSection tone="strong" density="editorial">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)] lg:items-start">
          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                Sistema operacional privado do imovel
              </span>
            </div>
            <h2 className="text-2xl font-medium leading-tight text-text-primary md:text-3xl">
              Governanca, manutencao e historico tecnico em um unico ativo.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              OS, documentos, garantias e inventario compoem uma linha tecnica unica para decisao e auditoria.
            </p>
          </div>

          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Saude tecnica</span>
              <span className={cn('text-sm font-medium', scoreColor(healthScore))}>{healthLabel}</span>
            </div>
            <ScoreBar score={healthScore} />
            <p className="mt-4 text-sm leading-6 text-text-secondary">
              {PROPERTY_TYPE_LABELS[property.type]} com {property.floors} pavimento(s) registrado(s) no HouseLog.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection title="Centro operacional" description="Leitura rapida do estado tecnico e financeiro do ativo." tone="strong" density="editorial">
        <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.48fr)] lg:items-start">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
                <Activity className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Prontuario vivo</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                  Operacao, evidencias e manutencao ficam vinculadas ao contexto real do imovel.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-strong)] text-text-secondary">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Governanca do ativo</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Dados tecnicos, recorrencias e historico preservados por propriedade.
                </p>
              </div>
            </div>
          </div>
        </div>

        {dashLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        ) : d ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Despesa mensal"
              value={formatCurrency(d.expenses.this_month ?? 0)}
              helper="Mes atual"
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
              label="OS concluidas"
              value={d.services.done}
              helper="Historico executado"
              icon={CheckCircle2}
              tone="success"
              density="compact"
            />
            <MetricCard
              label="Itens inventario"
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
        <PageSection
          title="Garantias a vencer"
          description="Itens com vencimento nos proximos 30 dias."
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <PropertySummaryCard property={property} className="h-full" />

        <PageSection title="Acesso rapido" description="Entradas diretas para os modulos do prontuario." tone="surface" density="editorial">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {[
              { href: `/properties/${id}/rooms`, icon: Home, label: 'Comodos', tone: 'default' as const },
              { href: `/properties/${id}/inventory`, icon: Package, label: 'Inventario', tone: 'warning' as const },
              { href: `/properties/${id}/services`, icon: Wrench, label: 'Servicos', tone: 'accent' as const },
              { href: `/properties/${id}/timeline`, icon: GitBranch, label: 'Timeline', tone: 'muted' as const },
              { href: `/properties/${id}/maintenance`, icon: RefreshCw, label: 'Manutencao', tone: 'warning' as const },
              { href: `/properties/${id}/documents`, icon: FileText, label: 'Documentos', tone: 'muted' as const },
              { href: `/properties/${id}/financial`, icon: BarChart3, label: 'Financeiro', tone: 'success' as const },
              { href: `/properties/${id}/report`, icon: Activity, label: 'Relatorio', tone: 'accent' as const },
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
        </PageSection>
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
