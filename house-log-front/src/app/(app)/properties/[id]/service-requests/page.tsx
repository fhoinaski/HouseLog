'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ClipboardList, FileSearch, HandCoins, Loader2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { usePagination } from '@/hooks/usePagination';
import { type ServiceRequestSummary } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const REQUEST_TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'waiting', label: 'Aguardando' },
  { key: 'proposals', label: 'Propostas' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'cancelled', label: 'Cancelados' },
] as const;

type RequestTabKey = (typeof REQUEST_TABS)[number]['key'];

const REQUEST_STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  OPEN: 'requested',
  CLOSED: 'completed',
};

function getRequestStage(request: ServiceRequestSummary) {
  if (request.accepted_proposals_count > 0) return 'Aprovado';
  if (request.status === 'CLOSED') return 'Cancelado';
  if (request.proposals_count > 0) return 'Com propostas';
  return 'Aguardando';
}

function matchesTab(request: ServiceRequestSummary, tab: RequestTabKey) {
  if (tab === 'all') return true;
  if (tab === 'waiting') return request.status === 'OPEN' && request.proposals_count === 0;
  if (tab === 'proposals') return request.status === 'OPEN' && request.proposals_count > 0 && request.accepted_proposals_count === 0;
  if (tab === 'approved') return request.accepted_proposals_count > 0;
  if (tab === 'cancelled') return request.status === 'CLOSED' && request.accepted_proposals_count === 0;
  return true;
}

export default function ServiceRequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<RequestTabKey>('all');
  const { data: requests, isLoadingMore, hasMore, loadMore } = usePagination<ServiceRequestSummary>(
    `/properties/${id}/service-requests`,
    { limit: '50' }
  );

  const visibleRequests = useMemo(
    () => requests.filter((request) => matchesTab(request, activeTab)),
    [activeTab, requests]
  );

  const counts = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        if (request.status === 'OPEN' && request.proposals_count === 0) acc.waiting += 1;
        if (request.status === 'OPEN' && request.proposals_count > 0 && request.accepted_proposals_count === 0) acc.proposals += 1;
        if (request.accepted_proposals_count > 0) acc.approved += 1;
        if (request.status === 'CLOSED' && request.accepted_proposals_count === 0) acc.cancelled += 1;
        return acc;
      },
      { waiting: 0, proposals: 0, approved: 0, cancelled: 0 }
    );
  }, [requests]);

  return (
    <div className="mx-auto max-w-[1040px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Ciclo de compra"
        title="Orcamentos"
        description="Solicitacoes enviadas para prestadores e propostas recebidas."
        actions={
          <Button variant="outline" disabled title="TODO: conectar ao fluxo real de criacao de service_request com upload.">
            <ClipboardList className="h-4 w-4" />
            Nova solicitacao
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard icon={FileSearch} label="Aguardando" value={counts.waiting} helper="sem proposta" tone="warning" density="compact" />
        <MetricCard icon={HandCoins} label="Propostas" value={counts.proposals} helper="para analise" tone="accent" density="compact" />
        <MetricCard icon={ClipboardList} label="Aprovados" value={counts.approved} helper="viram servicos" tone="success" density="compact" />
        <MetricCard icon={XCircle} label="Cancelados" value={counts.cancelled} helper="encerrados" tone="default" density="compact" />
      </div>

      <div className="flex flex-wrap gap-2 tap-highlight-none">
        {REQUEST_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="hl-chip"
            data-active={activeTab === tab.key ? 'true' : undefined}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <PageSection
        title="Solicitacoes de orcamento"
        description="Pedidos de orcamento ficam separados dos servicos ja aprovados."
        tone="strong"
        density="default"
      >
        {visibleRequests.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhum orcamento encontrado"
            description="Pedidos de orcamento enviados para prestadores e suas propostas aparecem aqui."
            actions={
              <Button variant="outline" disabled title="TODO: conectar criacao de service_request.">
                Nova solicitacao
              </Button>
            }
            tone="subtle"
            density="spacious"
          />
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-[var(--radius-xl)] border-half border-border-subtle bg-bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-text-primary">{request.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                        {request.description ?? 'Sem descricao detalhada.'}
                      </p>
                    </div>
                    <Badge variant={REQUEST_STATUS_VARIANT[request.status]} className="shrink-0">
                      {getRequestStage(request)}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <RequestInfo label="Sistema" value="A definir" />
                    <RequestInfo
                      label="Urgencia"
                      value={request.proposals_count === 0 ? 'Aguardando' : 'Em analise'}
                      urgent={request.proposals_count === 0}
                    />
                    <RequestInfo label="Propostas" value={String(request.proposals_count)} />
                    <RequestInfo
                      label="Melhor valor"
                      value={request.best_amount === null ? 'Sem valor' : formatCurrency(request.best_amount)}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                    <span className="text-xs text-text-tertiary">
                      Atualizado em {formatDate(request.updated_at ?? request.created_at)}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/properties/${id}/service-requests/${request.id}`}>
                        Ver propostas
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
                </Button>
              </div>
            )}
          </>
        )}
      </PageSection>
    </div>
  );
}

function RequestInfo({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
      <p className="mt-1 flex items-center gap-1 truncate font-medium text-text-primary">
        {urgent && <AlertTriangle className="h-3 w-3 text-text-warning" aria-hidden="true" />}
        {value}
      </p>
    </div>
  );
}
