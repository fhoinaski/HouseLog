import type { ServiceOrder } from '@/lib/api/_core';
import type { ServiceRequestSummary } from '@/lib/api/service-requests';

export type ServiceOrderStatus = ServiceOrder['status'];
export type ServiceRequestStage = 'waiting' | 'proposals' | 'approved' | 'closed';

export type KanbanColumnDefinition<TStatus extends string> = {
  id: TStatus;
  title: string;
  description: string;
};

export const SERVICE_ORDER_KANBAN_COLUMNS: Array<KanbanColumnDefinition<ServiceOrderStatus>> = [
  { id: 'requested', title: 'Novo', description: 'Aberta para triagem ou orçamento.' },
  { id: 'approved', title: 'Aprovado', description: 'Prestador ou escopo aprovado.' },
  { id: 'in_progress', title: 'Em execução', description: 'Serviço em andamento.' },
  { id: 'completed', title: 'Finalizado', description: 'Aguardando verificação.' },
  { id: 'verified', title: 'Verificado', description: 'Encerrado tecnicamente.' },
];

export const SERVICE_REQUEST_KANBAN_COLUMNS: Array<KanbanColumnDefinition<ServiceRequestStage>> = [
  { id: 'waiting', title: 'Novo', description: 'Chamado aberto sem proposta.' },
  { id: 'proposals', title: 'Orçamento enviado', description: 'Há propostas em análise.' },
  { id: 'approved', title: 'Aprovado', description: 'Proposta aceita para virar OS.' },
  { id: 'closed', title: 'Finalizado', description: 'Chamado fechado.' },
];

export const SERVICE_ORDER_STATUS_FLOW: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  requested: ['approved'],
  approved: ['requested', 'in_progress'],
  in_progress: ['approved', 'completed'],
  completed: ['in_progress', 'verified'],
  verified: [],
};

export function getServiceRequestStage(request: ServiceRequestSummary): ServiceRequestStage {
  if (request.accepted_proposals_count > 0) return 'approved';
  if (request.status === 'CLOSED') return 'closed';
  if (request.proposals_count > 0) return 'proposals';
  return 'waiting';
}

export function groupByStatus<TItem, TStatus extends string>(
  items: TItem[],
  columns: Array<KanbanColumnDefinition<TStatus>>,
  getStatus: (item: TItem) => TStatus
): Record<TStatus, TItem[]> {
  const grouped = columns.reduce(
    (acc, column) => ({ ...acc, [column.id]: [] }),
    {} as Record<TStatus, TItem[]>
  );

  items.forEach((item) => {
    grouped[getStatus(item)]?.push(item);
  });

  return grouped;
}
