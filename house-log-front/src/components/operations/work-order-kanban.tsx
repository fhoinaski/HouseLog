'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock3,
  Loader2,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  getServiceRequestStage,
  groupByStatus,
  SERVICE_ORDER_KANBAN_COLUMNS,
  SERVICE_ORDER_STATUS_FLOW,
  SERVICE_REQUEST_KANBAN_COLUMNS,
  type KanbanColumnDefinition,
  type ServiceOrderStatus,
  type ServiceRequestStage,
} from '@/components/operations/kanban-model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { StatusBadge as BaseStatusBadge } from '@/components/ui/status-badge';
import type { ServiceOrder } from '@/lib/api/_core';
import type { ServiceRequestSummary } from '@/lib/api/service-requests';
import {
  cn,
  formatCurrency,
  formatDate,
  SERVICE_STATUS_LABELS,
  SYSTEM_TYPE_LABELS,
} from '@/lib/utils';

type WorkOrderKanbanProps = {
  propertyId: string;
  serviceOrders?: ServiceOrder[];
  serviceRequests?: ServiceRequestSummary[];
  onMoveServiceOrder?: (order: ServiceOrder, status: ServiceOrderStatus) => Promise<void> | void;
  movingOrderId?: string | null;
  error?: string | null;
};

export function WorkOrderKanban({
  propertyId,
  serviceOrders = [],
  serviceRequests = [],
  onMoveServiceOrder,
  movingOrderId,
  error,
}: WorkOrderKanbanProps) {
  return (
    <div className="w-full min-w-0 space-y-5">
      {error && <KanbanErrorState message={error} />}

      {serviceRequests.length > 0 && (
        <section className="w-full min-w-0 space-y-3" aria-labelledby="service-requests-kanban-title">
          <KanbanSectionHeader
            eyebrow="Chamados"
            title="Pipeline de chamados e orçamentos"
            description="Chamados ainda não são movimentados por Kanban; o estágio vem das propostas reais."
          />
          <div className="w-full min-w-0 overflow-x-auto pb-4">
            <div className="flex w-max min-w-max gap-3">
              {SERVICE_REQUEST_KANBAN_COLUMNS.map((column) => {
                const items = groupByStatus(serviceRequests, SERVICE_REQUEST_KANBAN_COLUMNS, getServiceRequestStage)[column.id];

                return (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    count={items.length}
                    empty={<KanbanEmptyColumn label="Nenhum chamado neste estágio." />}
                  >
                    {items.map((request) => (
                      <TicketKanbanCard key={request.id} propertyId={propertyId} request={request} />
                    ))}
                  </KanbanColumn>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {serviceOrders.length > 0 && (
        <section className="w-full min-w-0 space-y-3" aria-labelledby="service-orders-kanban-title">
          <KanbanSectionHeader
            eyebrow="Ordens de serviço"
            title="Pipeline técnico de execução"
            description="A movimentação usa apenas transições existentes no domínio da OS."
          />
          <div className="w-full min-w-0 overflow-x-auto pb-4">
            <div className="flex w-max min-w-max gap-3">
              {SERVICE_ORDER_KANBAN_COLUMNS.map((column) => {
                const items = groupByStatus(serviceOrders, SERVICE_ORDER_KANBAN_COLUMNS, (order) => order.status)[column.id];

                return (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    count={items.length}
                    empty={<KanbanEmptyColumn label="Nenhuma OS neste estágio." />}
                  >
                    {items.map((order) => (
                      <ServiceOrderKanbanCard
                        key={order.id}
                        propertyId={propertyId}
                        order={order}
                        moving={movingOrderId === order.id}
                        onMove={onMoveServiceOrder}
                      />
                    ))}
                  </KanbanColumn>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {serviceOrders.length === 0 && serviceRequests.length === 0 && (
        <KanbanEmptyColumn label="Nenhum chamado ou ordem de serviço para organizar." spacious />
      )}
    </div>
  );
}

function KanbanSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hl-primary">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-hl-text">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-hl-text-muted">{description}</p>
    </div>
  );
}

export function KanbanColumn<TStatus extends string>({
  column,
  count,
  children,
  empty,
}: {
  column: KanbanColumnDefinition<TStatus>;
  count: number;
  children: ReactNode;
  empty: ReactNode;
}) {
  return (
    <div className="w-[280px] shrink-0 rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface-soft/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-hl-text">{column.title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-hl-text-muted">{column.description}</p>
        </div>
        <Badge className="border border-hl-border bg-hl-surface text-hl-text">{count}</Badge>
      </div>
      <div className="mt-3 space-y-2">{count === 0 ? empty : children}</div>
    </div>
  );
}

export function ServiceOrderKanbanCard({
  propertyId,
  order,
  moving,
  onMove,
}: {
  propertyId: string;
  order: ServiceOrder;
  moving?: boolean;
  onMove?: (order: ServiceOrder, status: ServiceOrderStatus) => Promise<void> | void;
}) {
  const transitions = SERVICE_ORDER_STATUS_FLOW[order.status];
  const mainTransition = transitions[transitions.length - 1];

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-[var(--hl-radius-md)] border border-hl-border bg-hl-surface p-3 shadow-[var(--hl-shadow-soft)]">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/properties/${propertyId}/services/${order.id}`}
          className="min-w-0 rounded-[var(--hl-radius-sm)] outline-none focus-visible:shadow-[var(--field-focus-ring)]"
        >
          <h4 className="line-clamp-2 text-sm font-semibold text-hl-text">{order.title}</h4>
          <p className="mt-1 truncate text-xs text-hl-text-muted">
            {SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type}
            {' · '}
            {order.room_name ?? 'Ambiente não informado'}
          </p>
        </Link>
        <PriorityBadge priority={order.priority} className="shrink-0 text-xs" />
      </div>

      <div className="mt-3 space-y-2 text-xs text-hl-text-muted">
        <KanbanMeta icon={<UserRound className="h-3.5 w-3.5" />} label={order.requested_by_name || 'Cliente não informado'} />
        <KanbanMeta icon={<Wrench className="h-3.5 w-3.5" />} label={order.assigned_to_name ?? 'Sem responsável'} />
        <KanbanMeta icon={<Clock3 className="h-3.5 w-3.5" />} label={getOrderDueLabel(order)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hl-border pt-3">
        <StatusBadge status={order.status} label={SERVICE_STATUS_LABELS[order.status] ?? order.status} />
        {mainTransition && onMove ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMove(order, mainTransition)}
            disabled={moving}
            aria-label={`Mover ${order.title} para ${SERVICE_STATUS_LABELS[mainTransition] ?? mainTransition}`}
          >
            {moving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            {SERVICE_STATUS_LABELS[mainTransition] ?? mainTransition}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function TicketKanbanCard({
  propertyId,
  request,
}: {
  propertyId: string;
  request: ServiceRequestSummary;
}) {
  const stage = getServiceRequestStage(request);

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-[var(--hl-radius-md)] border border-hl-border bg-hl-surface p-3 shadow-[var(--hl-shadow-soft)]">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/properties/${propertyId}/service-requests/${request.id}`}
          className="min-w-0 rounded-[var(--hl-radius-sm)] outline-none focus-visible:shadow-[var(--field-focus-ring)]"
        >
          <h4 className="line-clamp-2 text-sm font-semibold text-hl-text">{request.title}</h4>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-hl-text-muted">
            {request.description ?? 'Sem descrição detalhada.'}
          </p>
        </Link>
        <StatusBadge status={getTicketStatusTone(stage)} label={getTicketStageLabel(stage)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MiniMetric label="Cliente" value="Solicitante do imóvel" />
        <MiniMetric label="Imóvel" value="Imóvel atual" />
        <MiniMetric label="Propostas" value={String(request.proposals_count)} />
        <MiniMetric
          label="Melhor valor"
          value={request.best_amount === null ? 'Sem valor' : formatCurrency(request.best_amount)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hl-border pt-3 text-xs text-hl-text-muted">
        <span>Atualizado {formatDate(request.updated_at ?? request.created_at)}</span>
        {request.proposals_count === 0 && request.status === 'OPEN' ? (
          <AlertTriangle className="h-4 w-4 text-hl-warning" aria-label="Aguardando proposta" />
        ) : (
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
        )}
      </div>
    </article>
  );
}

export function StatusBadge({ status, label }: { status: string; label: ReactNode }) {
  return <BaseStatusBadge status={status} label={label} className="shrink-0" />;
}


export function KanbanEmptyColumn({ label, spacious }: { label: string; spacious?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--hl-radius-md)] border border-dashed border-hl-border bg-hl-surface px-3 py-4 text-center text-sm text-hl-text-muted',
        spacious && 'py-10'
      )}
    >
      {label}
    </div>
  );
}

export function KanbanErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--hl-radius-lg)] border border-[color-mix(in_srgb,var(--hl-danger)_25%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-danger)_8%,var(--hl-surface))] p-3 text-sm text-hl-danger">
      {message}
    </div>
  );
}

function KanbanMeta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </p>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[var(--hl-radius-sm)] bg-hl-surface-soft px-2.5 py-2">
      <p className="text-[11px] uppercase text-hl-text-muted">{label}</p>
      <p className="mt-0.5 truncate font-medium text-hl-text">{value}</p>
    </div>
  );
}

function getOrderDueLabel(order: ServiceOrder) {
  if (order.scheduled_at) return `Prazo ${formatDate(order.scheduled_at)}`;
  if (order.completed_at) return `Concluída ${formatDate(order.completed_at)}`;
  return `Atualizada ${formatDate(order.created_at)}`;
}

function getTicketStageLabel(stage: ServiceRequestStage) {
  if (stage === 'waiting') return 'Novo';
  if (stage === 'proposals') return 'Orçamento enviado';
  if (stage === 'approved') return 'Aprovado';
  return 'Finalizado';
}

function getTicketStatusTone(stage: ServiceRequestStage) {
  if (stage === 'waiting') return 'requested';
  if (stage === 'proposals') return 'submitted';
  if (stage === 'approved') return 'approved';
  return 'commercial_cancelled';
}
