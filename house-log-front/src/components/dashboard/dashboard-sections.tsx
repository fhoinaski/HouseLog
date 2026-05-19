'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, GitBranch, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSection } from '@/components/layout/page-section';
import { cn } from '@/lib/utils';
import type { DashboardActivityItem, DashboardPendingItem, DashboardPipelineStage } from './dashboard-model';

const pendingToneClass: Record<DashboardPendingItem['severity'], string> = {
  danger: 'border-l-hl-danger  bg-[color-mix(in_srgb,var(--hl-danger)_8%,var(--hl-surface))]',
  warning: 'border-l-hl-warning bg-[color-mix(in_srgb,var(--hl-warning)_8%,var(--hl-surface))]',
  info:    'border-l-hl-info    bg-[color-mix(in_srgb,var(--hl-info)_8%,var(--hl-surface))]',
};

const activityToneClass: Record<DashboardActivityItem['tone'], string> = {
  default: 'bg-hl-surface-soft text-hl-text-muted',
  accent:  'bg-hl-accent-muted text-hl-accent',
  success: 'bg-[color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))] text-hl-success',
  warning: 'bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))] text-hl-warning',
};

export function PipelineSummary({
  stages,
  isLoading,
}: {
  stages: DashboardPipelineStage[];
  isLoading: boolean;
}) {
  return (
    <PageSection
      title="Pipeline tecnico"
      description="Do chamado ao historico finalizado, sem perder o contexto do imovel."
      tone="surface"
      density="editorial"
      actions={<Badge variant="normal">{stages.reduce((sum, stage) => sum + stage.count, 0)} itens</Badge>}
    >
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="hl-skeleton h-28 rounded-[var(--hl-radius-card)]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="relative min-h-28 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--hl-radius-md)] bg-hl-surface-soft text-hl-text-muted">
                  <GitBranch className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <span className="text-2xl font-medium leading-none text-hl-text">{stage.count}</span>
              </div>
              <p className="mt-4 text-sm font-medium leading-tight text-hl-text">{stage.label}</p>
              <p className="mt-1 text-xs leading-5 text-hl-text-muted">{stage.description}</p>
              {index < stages.length - 1 ? (
                <ChevronRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-hl-border-strong xl:block" />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PageSection>
  );
}

export function CriticalPendingList({
  items,
  isLoading,
}: {
  items: DashboardPendingItem[];
  isLoading: boolean;
}) {
  return (
    <PageSection
      title="Pendencias criticas"
      description="Pontos que podem travar manutencao, garantia ou aprovacao."
      tone="strong"
      density="editorial"
      actions={items.length > 0 ? <Badge variant="urgent">{items.length}</Badge> : null}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="hl-skeleton h-20 rounded-[var(--hl-radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="Nenhuma pendencia critica"
          description="Nao ha urgencias, vencimentos ou orcamentos pendentes nos dados carregados."
          tone="subtle"
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'block rounded-[var(--hl-radius-card)] border border-hl-border border-l-4 px-4 py-3 transition-colors hover:bg-hl-surface-soft focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                pendingToneClass[item.severity]
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-hl-text">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-hl-text-muted">{item.description}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-hl-text-muted">{item.meta}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageSection>
  );
}

export function RecentActivityList({
  items,
  isLoading,
}: {
  items: DashboardActivityItem[];
  isLoading: boolean;
}) {
  return (
    <PageSection
      title="Atividades recentes"
      description="Movimentos tecnicos registrados no prontuario."
      tone="surface"
      density="editorial"
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="hl-skeleton h-16 rounded-[var(--hl-radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="Sem atividade recente"
          description="Novas OS, documentos e solicitacoes aparecerao aqui."
          tone="subtle"
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 rounded-[var(--hl-radius-card)] bg-hl-surface px-3 py-3 transition-colors hover:bg-hl-surface-soft focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--hl-radius-md)]', activityToneClass[item.tone])}>
                <ClipboardList className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-hl-text">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-hl-text-muted">{item.description}</span>
              </span>
              <span className="shrink-0 text-xs text-hl-text-muted">{item.dateLabel}</span>
            </Link>
          ))}
        </div>
      )}
    </PageSection>
  );
}

export function DashboardErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-[var(--hl-radius-card)] border border-[color-mix(in_srgb,var(--hl-danger)_25%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-danger)_8%,var(--hl-surface))] px-4 py-3 text-sm text-hl-text">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-hl-danger" strokeWidth={1.8} />
          <div>
            <p className="font-medium">Nao foi possivel carregar toda a central operacional.</p>
            <p className="mt-1 text-xs leading-5 text-hl-text-muted">
              A tela mantem somente dados recebidos com sucesso. Tente atualizar antes de tomar decisoes operacionais.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center rounded-[var(--hl-radius-md)] border border-hl-border bg-hl-surface px-3 text-xs font-medium text-hl-text transition-colors hover:bg-hl-surface-soft focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export function DashboardNoAccessState() {
  return (
    <PageSection tone="strong" density="editorial">
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Acesso ao dashboard indisponivel"
        description="Entre com uma conta autorizada para visualizar dados operacionais dos imoveis."
        tone="subtle"
      />
    </PageSection>
  );
}
