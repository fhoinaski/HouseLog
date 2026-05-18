export type DashboardPropertyInput = {
  id: string;
  name: string;
  address: string;
  healthScore?: number | null;
};

export type DashboardServiceStatus = 'requested' | 'approved' | 'in_progress' | 'completed' | 'verified';

export type DashboardServiceInput = {
  id: string;
  propertyId: string;
  title: string;
  status: DashboardServiceStatus;
  priority: 'urgent' | 'normal' | 'preventive';
  createdAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  assignedToName: string | null;
  cost: number | null;
};

export type DashboardServiceRequestInput = {
  id: string;
  propertyId: string;
  title: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  proposalsCount: number;
  pendingProposalsCount: number;
  acceptedProposalsCount: number;
  bestAmount: number | null;
};

export type DashboardWarrantyInput = {
  id: string;
  propertyId: string;
  title: string;
  providerName: string | null;
  status: 'active' | 'expired' | 'claimed' | 'void';
  endDate: string;
  createdAt: string;
};

export type DashboardDocumentInput = {
  id: string;
  propertyId: string;
  title: string;
  type: string;
  createdAt: string;
  expiryDate: string | null;
};

export type DashboardPipelineStage = {
  id: 'new' | 'diagnosis' | 'budget' | 'approved' | 'execution' | 'finished';
  label: string;
  count: number;
  description: string;
};

export type DashboardActivityItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  date: string;
  dateLabel: string;
  tone: 'default' | 'accent' | 'success' | 'warning';
};

export type DashboardPendingItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  meta: string;
  severity: 'danger' | 'warning' | 'info';
};

export type DashboardModel = {
  metrics: {
    activeProperties: number;
    openTickets: number;
    inProgressOrders: number;
    pendingBudgets: number;
    expiringWarranties: number;
    documents: number;
  };
  pipeline: DashboardPipelineStage[];
  activities: DashboardActivityItem[];
  criticalPendings: DashboardPendingItem[];
};

export type BuildDashboardModelInput = {
  properties: DashboardPropertyInput[];
  services: DashboardServiceInput[];
  serviceRequests: DashboardServiceRequestInput[];
  warranties: DashboardWarrantyInput[];
  documents: DashboardDocumentInput[];
  now?: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTime(value: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function daysUntil(value: string | null, now: Date): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function propertyNameById(properties: DashboardPropertyInput[]) {
  return new Map(properties.map((property) => [property.id, property.name] as const));
}

export function buildDashboardModel(input: BuildDashboardModelInput): DashboardModel {
  const now = input.now ?? new Date();
  const allowedPropertyIds = new Set(input.properties.map((property) => property.id));
  const propertiesById = propertyNameById(input.properties);

  const services = input.services.filter((service) => allowedPropertyIds.has(service.propertyId));
  const serviceRequests = input.serviceRequests.filter((request) => allowedPropertyIds.has(request.propertyId));
  const warranties = input.warranties.filter((warranty) => allowedPropertyIds.has(warranty.propertyId));
  const documents = input.documents.filter((document) => allowedPropertyIds.has(document.propertyId));

  const openTickets =
    services.filter((service) => ['requested', 'approved', 'in_progress'].includes(service.status)).length +
    serviceRequests.filter((request) => request.status === 'OPEN').length;
  const inProgressOrders = services.filter((service) => service.status === 'in_progress').length;
  const pendingBudgets = serviceRequests.filter(
    (request) => request.status === 'OPEN' && request.pendingProposalsCount > 0
  ).length;
  const expiringWarrantyRows = warranties.filter((warranty) => {
    const days = daysUntil(warranty.endDate, now);
    return warranty.status === 'active' && days !== null && days >= 0 && days <= 30;
  });

  const pipeline: DashboardPipelineStage[] = [
    {
      id: 'new',
      label: 'Novo chamado',
      count: serviceRequests.filter((request) => request.status === 'OPEN' && request.proposalsCount === 0).length,
      description: 'Solicitacoes aguardando triagem',
    },
    {
      id: 'diagnosis',
      label: 'Diagnostico',
      count: services.filter((service) => service.status === 'requested').length,
      description: 'OS abertas para qualificacao',
    },
    {
      id: 'budget',
      label: 'Orcamento',
      count: pendingBudgets,
      description: 'Propostas pendentes de decisao',
    },
    {
      id: 'approved',
      label: 'Aprovado',
      count:
        services.filter((service) => service.status === 'approved').length +
        serviceRequests.filter((request) => request.status === 'OPEN' && request.acceptedProposalsCount > 0).length,
      description: 'Trabalho liberado para execucao',
    },
    {
      id: 'execution',
      label: 'Em execucao',
      count: inProgressOrders,
      description: 'OS acompanhadas em campo',
    },
    {
      id: 'finished',
      label: 'Finalizado',
      count: services.filter((service) => service.status === 'completed' || service.status === 'verified').length,
      description: 'Historico tecnico fechado',
    },
  ];

  const urgentServices: DashboardPendingItem[] = services
    .filter((service) => service.priority === 'urgent' && ['requested', 'approved', 'in_progress'].includes(service.status))
    .map((service) => ({
      id: `service-${service.id}`,
      title: service.title,
      description: propertiesById.get(service.propertyId) ?? 'Imovel',
      href: `/properties/${service.propertyId}/services/${service.id}`,
      meta: service.status === 'in_progress' ? 'Em execucao' : 'Urgente',
      severity: 'danger',
    }));

  const pendingBudgetItems: DashboardPendingItem[] = serviceRequests
    .filter((request) => request.status === 'OPEN' && request.pendingProposalsCount > 0)
    .map((request) => ({
      id: `request-${request.id}`,
      title: request.title,
      description: `${propertiesById.get(request.propertyId) ?? 'Imovel'} - ${request.pendingProposalsCount} proposta(s) pendente(s)`,
      href: `/properties/${request.propertyId}/service-requests/${request.id}`,
      meta: request.bestAmount !== null ? request.bestAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Orcamento',
      severity: 'warning',
    }));

  const warrantyItems: DashboardPendingItem[] = expiringWarrantyRows.map((warranty) => {
    const days = daysUntil(warranty.endDate, now) ?? 0;
    return {
      id: `warranty-${warranty.id}`,
      title: warranty.title,
      description: `${propertiesById.get(warranty.propertyId) ?? 'Imovel'}${warranty.providerName ? ` - ${warranty.providerName}` : ''}`,
      href: `/properties/${warranty.propertyId}/warranties`,
      meta: days === 0 ? 'Vence hoje' : `${days}d`,
      severity: days <= 7 ? 'danger' : 'warning',
    };
  });

  const expiringDocumentItems: DashboardPendingItem[] = documents
    .map((document) => ({ document, days: daysUntil(document.expiryDate, now) }))
    .filter((item): item is { document: DashboardDocumentInput; days: number } => item.days !== null && item.days >= 0 && item.days <= 30)
    .map(({ document, days }) => ({
      id: `document-${document.id}`,
      title: document.title,
      description: `${propertiesById.get(document.propertyId) ?? 'Imovel'} - documento com validade proxima`,
      href: `/properties/${document.propertyId}/documents`,
      meta: days === 0 ? 'Vence hoje' : `${days}d`,
      severity: days <= 7 ? 'danger' : 'info',
    }));

  const criticalPendings = [...urgentServices, ...pendingBudgetItems, ...warrantyItems, ...expiringDocumentItems].slice(0, 8);

  const serviceActivities: DashboardActivityItem[] = services.map((service) => ({
    id: `service-${service.id}`,
    title: service.title,
    description: `${propertiesById.get(service.propertyId) ?? 'Imovel'} - ${service.status === 'completed' || service.status === 'verified' ? 'OS finalizada' : 'OS atualizada'}`,
    href: `/properties/${service.propertyId}/services/${service.id}`,
    date: service.completedAt ?? service.createdAt,
    dateLabel: dateLabel(service.completedAt ?? service.createdAt),
    tone: service.status === 'completed' || service.status === 'verified' ? 'success' : service.status === 'in_progress' ? 'accent' : 'default',
  }));

  const requestActivities: DashboardActivityItem[] = serviceRequests.map((request) => ({
    id: `request-${request.id}`,
    title: request.title,
    description: `${propertiesById.get(request.propertyId) ?? 'Imovel'} - solicitacao de orcamento`,
    href: `/properties/${request.propertyId}/service-requests/${request.id}`,
    date: request.updatedAt,
    dateLabel: dateLabel(request.updatedAt),
    tone: request.pendingProposalsCount > 0 ? 'warning' : 'default',
  }));

  const documentActivities: DashboardActivityItem[] = documents.map((document) => ({
    id: `document-${document.id}`,
    title: document.title,
    description: `${propertiesById.get(document.propertyId) ?? 'Imovel'} - documento registrado`,
    href: `/properties/${document.propertyId}/documents/${document.id}`,
    date: document.createdAt,
    dateLabel: dateLabel(document.createdAt),
    tone: 'default',
  }));

  const activities = [...serviceActivities, ...requestActivities, ...documentActivities]
    .sort((a, b) => parseTime(b.date) - parseTime(a.date))
    .slice(0, 8);

  return {
    metrics: {
      activeProperties: input.properties.length,
      openTickets,
      inProgressOrders,
      pendingBudgets,
      expiringWarranties: expiringWarrantyRows.length,
      documents: documents.length,
    },
    pipeline,
    activities,
    criticalPendings,
  };
}
