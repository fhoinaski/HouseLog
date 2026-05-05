'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import useSWR from 'swr';
import { ClipboardCheck, FolderKanban, ShieldCheck } from 'lucide-react';
import {
  handoverChecklistApi,
  handoverPackagesApi,
  renovationsApi,
  warrantiesApi,
  type HandoverChecklistItem,
  type HandoverPackage,
  type Renovation,
  type Warranty,
} from '@/lib/api';
import { PageSection } from '@/components/layout/page-section';
import { cn } from '@/lib/utils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return Infinity;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

// ─── mini metric box ──────────────────────────────────────────────────────────

type MetricTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

function MiniMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: MetricTone;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] px-3 py-2.5',
        tone === 'default' && 'bg-bg-subtle',
        tone === 'success' && 'bg-bg-success',
        tone === 'warning' && 'bg-bg-warning',
        tone === 'danger' && 'bg-bg-danger',
        tone === 'accent' && 'bg-bg-accent-subtle'
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-xl font-light tabular-nums',
          tone === 'default' && 'text-text-primary',
          tone === 'success' && 'text-text-success',
          tone === 'warning' && 'text-text-warning',
          tone === 'danger' && 'text-text-danger',
          tone === 'accent' && 'text-text-accent'
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ─── section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  href,
  linkLabel,
  empty,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  linkLabel: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-xl)] border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <span className="text-sm font-medium text-text-primary">{title}</span>
        </div>
        <Link
          href={href}
          className="text-xs text-text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {linkLabel}
        </Link>
      </div>
      {empty ? (
        <p className="text-xs text-text-tertiary">Nenhum registro encontrado.</p>
      ) : (
        children
      )}
    </div>
  );
}

// ─── warranty section ─────────────────────────────────────────────────────────

function WarrantySection({ warranties, propertyId }: { warranties: Warranty[]; propertyId: string }) {
  const active = warranties.filter((w) => w.status === 'active').length;
  const expiring = warranties.filter(
    (w) => w.status === 'active' && daysUntil(w.end_date) <= 30
  ).length;
  const expired = warranties.filter((w) => w.status === 'expired').length;

  return (
    <SectionCard
      title="Garantias"
      icon={ShieldCheck}
      href={`/properties/${propertyId}/warranties`}
      linkLabel="Ver garantias →"
      empty={warranties.length === 0}
    >
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="Ativas" value={active} tone="success" />
        <MiniMetric label="A vencer" value={expiring} tone={expiring > 0 ? 'warning' : 'default'} />
        <MiniMetric label="Vencidas" value={expired} tone={expired > 0 ? 'danger' : 'default'} />
      </div>
    </SectionCard>
  );
}

// ─── renovation section ───────────────────────────────────────────────────────

function RenovationSection({ renovations, propertyId }: { renovations: Renovation[]; propertyId: string }) {
  const inProgress = renovations.filter((r) => r.status === 'in_progress').length;
  const completed = renovations.filter((r) => r.status === 'completed').length;

  return (
    <SectionCard
      title="Reformas"
      icon={FolderKanban}
      href={`/properties/${propertyId}/renovations`}
      linkLabel="Ver reformas →"
      empty={renovations.length === 0}
    >
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="Andamento" value={inProgress} tone={inProgress > 0 ? 'accent' : 'default'} />
        <MiniMetric label="Concluidas" value={completed} tone="success" />
        <MiniMetric label="Total" value={renovations.length} />
      </div>
    </SectionCard>
  );
}

// ─── handover section ─────────────────────────────────────────────────────────

function HandoverSection({
  packages,
  items,
  itemsLoading,
  propertyId,
}: {
  packages: HandoverPackage[];
  items: HandoverChecklistItem[] | null;
  itemsLoading: boolean;
  propertyId: string;
}) {
  const done = items?.filter((i) => i.status === 'done').length ?? 0;
  const issue = items?.filter((i) => i.status === 'issue').length ?? 0;
  const total = items?.length ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <SectionCard
      title="Handover"
      icon={ClipboardCheck}
      href={`/properties/${propertyId}/handover`}
      linkLabel="Ver handover →"
      empty={packages.length === 0}
    >
      <div className="space-y-3">
        {itemsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="hl-skeleton h-12 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <MiniMetric label="Pacotes" value={packages.length} />
            <MiniMetric label="Progresso" value={`${percent}%`} tone="accent" />
            <MiniMetric label="Issues" value={issue} tone={issue > 0 ? 'danger' : 'default'} />
          </div>
        )}
        {!itemsLoading && total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-text-tertiary">
              <span>Checklist do pacote mais recente</span>
              <span className="tabular-nums">{done}/{total} itens</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
              <div
                className="h-full rounded-full bg-bg-accent-subtle transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function PremiumPropertyDashboard({ propertyId }: { propertyId: string }) {
  const { data: wData, error: wError, isLoading: wLoading } = useSWR(
    ['warranties', propertyId],
    () => warrantiesApi.list(propertyId)
  );
  const { data: rData, error: rError, isLoading: rLoading } = useSWR(
    ['renovations', propertyId],
    () => renovationsApi.list(propertyId)
  );
  const { data: pData, error: pError, isLoading: pLoading } = useSWR(
    ['handover-packages', propertyId],
    () => handoverPackagesApi.list(propertyId)
  );

  const warranties = wData?.warranties ?? [];
  const renovations = rData?.renovations ?? [];
  // Stable reference required as dependency for latestPackage useMemo below.
  const packages = useMemo(() => pData?.packages ?? [], [pData]);

  // Fetch checklist only for the most recent package to avoid N+1 calls.
  // Risk: if the property has many packages, only the latest is summarized.
  const latestPackage = useMemo(() => {
    if (!packages.length) return null;
    return [...packages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null;
  }, [packages]);

  const { data: checklistData, isLoading: checklistLoading } = useSWR(
    latestPackage ? ['handover-checklist', propertyId, latestPackage.id] : null,
    () => handoverChecklistApi.list(propertyId, latestPackage!.id)
  );

  const anyLoading = wLoading || rLoading || pLoading;

  if (anyLoading) {
    return (
      <PageSection
        title="Prontuário técnico"
        description="Consolidado de garantias, reformas e handover do imóvel."
        tone="strong"
        density="editorial"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="hl-skeleton h-32 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      </PageSection>
    );
  }

  const hasError = !!(wError ?? rError ?? pError);

  return (
    <PageSection
      title="Prontuário técnico"
      description="Consolidado de garantias, reformas e handover do imóvel."
      tone="strong"
      density="editorial"
    >
      {hasError && (
        <p className="mb-3 rounded-[var(--radius-lg)] bg-bg-warning px-3 py-2 text-xs text-text-warning">
          Alguns dados do prontuario nao puderam ser carregados. Recarregue a pagina para tentar novamente.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <WarrantySection warranties={warranties} propertyId={propertyId} />
        <RenovationSection renovations={renovations} propertyId={propertyId} />
        <HandoverSection
          packages={packages}
          items={checklistData?.items ?? null}
          itemsLoading={!!(latestPackage && checklistLoading)}
          propertyId={propertyId}
        />
      </div>
    </PageSection>
  );
}
