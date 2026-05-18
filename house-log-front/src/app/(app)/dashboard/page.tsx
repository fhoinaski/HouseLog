'use client';

import { type ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart2,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FilePlus,
  Package,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  CriticalPendingList,
  DashboardErrorPanel,
  DashboardNoAccessState,
  PipelineSummary,
  RecentActivityList,
} from '@/components/dashboard/dashboard-sections';
import { buildDashboardModel, type DashboardDocumentInput, type DashboardServiceInput } from '@/components/dashboard/dashboard-model';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import {
  documentsApi,
  propertiesApi,
  serviceRequestsApi,
  servicesApi,
  warrantiesApi,
  type Document,
  type Property,
  type ServiceOrder,
  type Warranty,
} from '@/lib/api';
import { cn } from '@/lib/utils';

type PropertyListItem = Property & {
  activeServicesCount: number;
  completedServicesCount: number;
  coverPhotoUrl?: string;
  photoUrl?: string;
};

type ScheduleItem = {
  id: string;
  serviceOrderId: string;
  propertyId: string;
  title: string;
  time: string;
  propertyName: string;
  status: 'confirmed' | 'in_progress' | 'pending';
};

type QuickActionIntent = 'new-service' | 'schedule' | 'inventory' | 'report';

type QuickActionItem = {
  label: string;
  description: string;
  icon: LucideIcon;
  intent: QuickActionIntent;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia,';
  if (hour < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

function formatDashboardDate() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function isToday(dateValue: string | null): boolean {
  if (!dateValue) return false;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return false;
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
}

const QUICK_ACTIONS = [
  { label: 'Nova OS', description: 'Abrir demanda', icon: FilePlus, intent: 'new-service' },
  { label: 'Agendar', description: 'Rotina preventiva', icon: CalendarDays, intent: 'schedule' },
  { label: 'Inventario', description: 'Mapear ativos', icon: Package, intent: 'inventory' },
  { label: 'Relatorios', description: 'Saude do imovel', icon: BarChart2, intent: 'report' },
] satisfies QuickActionItem[];

const QUICK_ACTION_ROUTE: Record<QuickActionIntent, (propertyId: string) => string> = {
  'new-service': (propertyId) => `/properties/${propertyId}/services/new`,
  schedule: (propertyId) => `/properties/${propertyId}/maintenance`,
  inventory: (propertyId) => `/properties/${propertyId}/inventory`,
  report: (propertyId) => `/properties/${propertyId}/report`,
};

const QUICK_ACTION_DIALOG_COPY: Record<QuickActionIntent, { title: string; description: string }> = {
  'new-service': {
    title: 'Escolha o imovel da nova OS',
    description:
      'A ordem de servico precisa nascer dentro do prontuario correto para manter historico, anexos e responsaveis no contexto certo.',
  },
  schedule: {
    title: 'Escolha onde agendar',
    description:
      'Os agendamentos preventivos sao organizados por imovel para preservar recorrencias e historico tecnico.',
  },
  inventory: {
    title: 'Escolha o inventario',
    description: 'Cada inventario pertence a um imovel especifico e deve ser acessado no contexto do ativo.',
  },
  report: {
    title: 'Escolha o relatorio',
    description:
      'Os relatorios disponiveis hoje sao calculados por imovel, com score tecnico, manutencao e documentacao.',
  },
};

function PropertyThumbnail({ name, photoUrl }: { name: string; photoUrl?: string }) {
  if (photoUrl) {
    return (
      <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[var(--radius-md)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle">
      <span className="text-sm font-medium text-text-accent">{getInitials(name)}</span>
    </div>
  );
}

function PropertyRow({ property, action }: { property: PropertyListItem; action?: ReactNode }) {
  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-3 text-left transition-colors hover:bg-[var(--field-bg-hover)]">
      <PropertyThumbnail name={property.name} photoUrl={property.coverPhotoUrl ?? property.photoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{property.name}</p>
        <p className="mt-0.5 truncate text-xs text-text-secondary">{property.address}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {property.activeServicesCount > 0 && <Badge variant="requested">{property.activeServicesCount} OS aberta(s)</Badge>}
          {property.completedServicesCount > 0 && <Badge variant="completed">{property.completedServicesCount} OK</Badge>}
          {property.activeServicesCount === 0 && property.completedServicesCount === 0 && <Badge variant="normal">Sem OS abertas</Badge>}
        </div>
      </div>
      {action}
    </div>
  );
}

function QuickActions({ properties, isLoading }: { properties: PropertyListItem[]; isLoading: boolean }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<QuickActionItem | null>(null);
  const selectedCopy = pendingAction ? QUICK_ACTION_DIALOG_COPY[pendingAction.intent] : null;

  function destinationFor(action: QuickActionItem, propertyId: string) {
    return QUICK_ACTION_ROUTE[action.intent](propertyId);
  }

  function handleAction(action: QuickActionItem) {
    if (isLoading) return;
    if (properties.length === 0) {
      router.push('/properties/new');
      return;
    }

    const onlyProperty = properties[0];
    if (properties.length === 1 && onlyProperty) {
      router.push(destinationFor(action, onlyProperty.id));
      return;
    }

    setPendingAction(action);
  }

  function chooseProperty(propertyId: string) {
    if (!pendingAction) return;
    router.push(destinationFor(pendingAction, propertyId));
    setPendingAction(null);
  }

  return (
    <>
      <PageSection
        title="Operacao sem atrito"
        description="Acoes rapidas conectadas ao prontuario real de cada imovel."
        tone="surface"
        density="editorial"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.intent}
                type="button"
                disabled={isLoading}
                onClick={() => handleAction(action)}
                className="group flex min-h-28 flex-col justify-between rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 text-left transition-all duration-150 hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-text-primary">{action.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-text-tertiary">{action.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PageSection>

      <Dialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-xl">
          <div className="p-4 pb-2 sm:p-5 sm:pb-2">
            <DialogHeader>
              <DialogTitle>{selectedCopy?.title}</DialogTitle>
              <DialogDescription className="leading-6">{selectedCopy?.description}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[64vh] overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="space-y-2">
              {properties.map((property) => (
                <button key={property.id} type="button" onClick={() => chooseProperty(property.id)} className="block w-full">
                  <PropertyRow
                    property={property}
                    action={<ChevronRight size={17} strokeWidth={1.8} className="shrink-0 text-text-disabled" />}
                  />
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3">
              <p className="text-xs leading-5 text-text-secondary">
                Nao encontrou o ativo certo? Cadastre um novo imovel antes de iniciar a acao operacional.
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-2">
                <Link href="/properties/new">Adicionar imovel</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PropertiesSection({ properties, isLoading }: { properties: PropertyListItem[]; isLoading: boolean }) {
  return (
    <PageSection
      title="Imoveis gerenciados"
      description="Ativos sob acompanhamento operacional."
      tone="strong"
      density="editorial"
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href="/properties">Ver todos</Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-3">
              <div className="hl-skeleton h-[52px] w-[52px] shrink-0 rounded-[var(--radius-md)]" />
              <div className="flex-1 space-y-2">
                <div className="hl-skeleton h-4 w-3/4 rounded" />
                <div className="hl-skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nenhum imovel cadastrado"
          description="Comece criando o primeiro ativo para liberar a visao operacional."
          actions={
            <Button asChild variant="tonal" size="sm">
              <Link href="/properties/new">Adicionar imovel</Link>
            </Button>
          }
          tone="subtle"
        />
      ) : (
        <div className="space-y-2">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`} className="block">
              <PropertyRow property={property} />
            </Link>
          ))}
        </div>
      )}
    </PageSection>
  );
}

function AgendaSection({ schedule, isLoading }: { schedule: ScheduleItem[]; isLoading: boolean }) {
  return (
    <PageSection
      title="Agenda de hoje"
      description="Visitas, execucoes e compromissos tecnicos previstos para o dia."
      tone="surface"
      density="editorial"
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-3">
              <div className="hl-skeleton h-9 w-1 shrink-0 rounded-sm" />
              <div className="flex-1 space-y-2">
                <div className="hl-skeleton h-4 w-2/3 rounded" />
                <div className="hl-skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : schedule.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title="Nenhum servico agendado para hoje"
          description="A operacao do dia esta livre de visitas programadas."
          tone="subtle"
        />
      ) : (
        <div className="space-y-2">
          {schedule.map((item, index) => (
            <Link
              key={item.id ?? index}
              href={`/properties/${item.propertyId}/services/${item.serviceOrderId}`}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-3 transition-colors hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
            >
              <div
                className={cn(
                  'h-9 w-1 shrink-0 rounded-sm',
                  item.status === 'confirmed' || item.status === 'in_progress' ? 'bg-text-success' : 'bg-text-warning'
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {item.time} - {item.propertyName}
                </p>
              </div>
              <ChevronRight size={16} strokeWidth={1.8} className="shrink-0 text-text-disabled" />
            </Link>
          ))}
        </div>
      )}
    </PageSection>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const {
    data: propertiesData,
    isLoading: propertiesLoading,
    error: propertiesError,
    mutate: retryProperties,
  } = useSWR(
    user ? 'properties' : null,
    () => propertiesApi.list({ limit: 50 }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const baseProperties = useMemo(() => propertiesData?.data ?? [], [propertiesData]);
  const propertyIds = useMemo(() => baseProperties.map((property) => property.id), [baseProperties]);

  const {
    data: servicesMap,
    isLoading: servicesLoading,
    error: servicesError,
    mutate: retryServices,
  } = useSWR(
    user && propertyIds.length > 0 ? ['dashboard-services', ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (propertyId) => {
          const response = await servicesApi.list(propertyId);
          return [propertyId, response.data] as const;
        })
      );
      return new Map<string, ServiceOrder[]>(entries);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const {
    data: serviceRequestsMap,
    isLoading: serviceRequestsLoading,
    error: serviceRequestsError,
    mutate: retryServiceRequests,
  } = useSWR(
    user && propertyIds.length > 0 ? ['dashboard-service-requests', ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (propertyId) => {
          const response = await serviceRequestsApi.list(propertyId, { limit: 50 });
          return [propertyId, response.data] as const;
        })
      );
      return new Map(entries);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const {
    data: warrantiesMap,
    isLoading: warrantiesLoading,
    error: warrantiesError,
    mutate: retryWarranties,
  } = useSWR(
    user && propertyIds.length > 0 ? ['dashboard-warranties', ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (propertyId) => {
          const response = await warrantiesApi.list(propertyId, { status: 'active' });
          return [propertyId, response.warranties] as const;
        })
      );
      return new Map<string, Warranty[]>(entries);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const {
    data: documentsMap,
    isLoading: documentsLoading,
    error: documentsError,
    mutate: retryDocuments,
  } = useSWR(
    user && propertyIds.length > 0 ? ['dashboard-documents', ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (propertyId) => {
          const response = await documentsApi.list(propertyId);
          return [propertyId, response.data] as const;
        })
      );
      return new Map<string, Document[]>(entries);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const properties = useMemo<PropertyListItem[]>(() => {
    return baseProperties.map((property) => {
      const items = servicesMap?.get(property.id) ?? [];
      const activeServicesCount = items.filter((item) => ['requested', 'approved', 'in_progress'].includes(item.status)).length;
      const completedServicesCount = items.filter((item) => ['completed', 'verified'].includes(item.status)).length;
      return { ...property, activeServicesCount, completedServicesCount };
    });
  }, [baseProperties, servicesMap]);

  const todaySchedule = useMemo<ScheduleItem[]>(() => {
    const byProperty = new Map(baseProperties.map((property) => [property.id, property.name] as const));
    const rows: ScheduleItem[] = [];

    servicesMap?.forEach((services, propertyId) => {
      const propertyName = byProperty.get(propertyId) ?? 'Imovel';
      services
        .filter((service) => isToday(service.scheduled_at))
        .forEach((service) => {
          rows.push({
            id: service.id,
            serviceOrderId: service.id,
            propertyId,
            title: service.title,
            time: service.scheduled_at
              ? new Date(service.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '-',
            propertyName,
            status: service.status === 'in_progress' ? 'in_progress' : service.status === 'approved' ? 'confirmed' : 'pending',
          });
        });
    });

    return rows.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 8);
  }, [baseProperties, servicesMap]);

  const dashboardModel = useMemo(() => {
    const services: DashboardServiceInput[] = Array.from(servicesMap?.values() ?? [])
      .flat()
      .map((service) => ({
        id: service.id,
        propertyId: service.property_id,
        title: service.title,
        status: service.status,
        priority: service.priority,
        createdAt: service.created_at,
        scheduledAt: service.scheduled_at,
        completedAt: service.completed_at,
        assignedToName: service.assigned_to_name,
        cost: service.cost,
      }));

    const serviceRequests = Array.from(serviceRequestsMap?.values() ?? [])
      .flat()
      .map((request) => ({
        id: request.id,
        propertyId: request.property_id,
        title: request.title,
        status: request.status,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        proposalsCount: request.proposals_count,
        pendingProposalsCount: request.pending_proposals_count,
        acceptedProposalsCount: request.accepted_proposals_count,
        bestAmount: request.best_amount,
      }));

    const warranties = Array.from(warrantiesMap?.values() ?? [])
      .flat()
      .map((warranty) => ({
        id: warranty.id,
        propertyId: warranty.property_id,
        title: warranty.title,
        providerName: warranty.provider_name,
        status: warranty.status,
        endDate: warranty.end_date,
        createdAt: warranty.created_at,
      }));

    const documents: DashboardDocumentInput[] = Array.from(documentsMap?.values() ?? [])
      .flat()
      .map((document) => ({
        id: document.id,
        propertyId: document.property_id,
        title: document.title,
        type: document.type,
        createdAt: document.created_at,
        expiryDate: document.expiry_date,
      }));

    return buildDashboardModel({
      properties: baseProperties.map((property) => ({
        id: property.id,
        name: property.name,
        address: property.address,
        healthScore: property.health_score,
      })),
      services,
      serviceRequests,
      warranties,
      documents,
    });
  }, [baseProperties, documentsMap, serviceRequestsMap, servicesMap, warrantiesMap]);

  const activeServices = dashboardModel.metrics.openTickets;
  const completedServices = properties.reduce((sum, property) => sum + property.completedServicesCount, 0);
  const firstName = user?.name?.split(' ')[0] ?? 'voce';
  const isLoadingDashboard =
    propertiesLoading || servicesLoading || serviceRequestsLoading || warrantiesLoading || documentsLoading;
  const hasDashboardError = Boolean(propertiesError || servicesError || serviceRequestsError || warrantiesError || documentsError);

  function retryDashboard() {
    void retryProperties();
    void retryServices();
    void retryServiceRequests();
    void retryWarranties();
    void retryDocuments();
  }

  if (!user) {
    return (
      <PageContainer className="space-y-6">
        <DashboardNoAccessState />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        density="editorial"
        eyebrow="HouseLog Calm OS"
        title={`${getGreeting()} ${firstName}`}
        description="Visao operacional dos imoveis, ordens de servico e decisoes pendentes em uma leitura rapida."
        actions={
          <div className="rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface px-4 py-3 text-left shadow-hl-subtle">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">{formatDashboardDate()}</p>
            <p className="mt-1 text-sm text-hl-text-muted">{activeServices} operacoes abertas</p>
          </div>
        }
      />

      {hasDashboardError ? <DashboardErrorPanel onRetry={retryDashboard} /> : null}

      <PageSection tone="surface" density="editorial">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="hidden rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-5 md:block">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Sistema operacional privado</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight text-hl-text md:text-3xl">
              Clareza tecnica para cada decisao do imovel.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-hl-text-muted">
              Acompanhe portfolio, demandas abertas, agenda e aprovacoes sem sair do contexto real dos ativos.
            </p>
          </div>

          <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Lente operacional</p>
            <p className="mt-2 text-2xl font-medium leading-tight text-hl-text">{activeServices} operacoes abertas</p>
            <p className="mt-2 text-sm leading-6 text-hl-text-muted">
              {dashboardModel.metrics.pendingBudgets > 0
                ? `${dashboardModel.metrics.pendingBudgets} orcamento(s) precisam de analise.`
                : 'Sem orcamentos pendentes para aprovacao.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={todaySchedule.length > 0 ? 'approved' : 'normal'}>{todaySchedule.length} hoje</Badge>
              <Badge variant={activeServices > 0 ? 'in_progress' : 'normal'}>{properties.length} imoveis</Badge>
              <Badge variant={dashboardModel.metrics.expiringWarranties > 0 ? 'requested' : 'normal'}>
                {dashboardModel.metrics.expiringWarranties} garantias
              </Badge>
            </div>
          </div>
        </div>
      </PageSection>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={Building2} label="Imoveis ativos" value={dashboardModel.metrics.activeProperties} helper="ativos monitorados" tone="accent" />
        <MetricCard icon={ClipboardCheck} label="Chamados abertos" value={activeServices} helper="demandas e OS em aberto" tone="warning" />
        <MetricCard icon={Wrench} label="OS em campo" value={dashboardModel.metrics.inProgressOrders} helper="execucao em andamento" tone="default" />
        <MetricCard icon={ShieldCheck} label="Garantias vencendo" value={dashboardModel.metrics.expiringWarranties} helper="proximos 30 dias" tone="success" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={Clock3} label="Agenda hoje" value={todaySchedule.length} helper="visitas e execucoes" tone="default" density="compact" />
        <MetricCard icon={CalendarCheck} label="Concluidas" value={completedServices} helper="historico finalizado" tone="success" density="compact" />
        <MetricCard icon={FileText} label="Documentos" value={dashboardModel.metrics.documents} helper="registros carregados" tone="default" density="compact" />
        <MetricCard icon={BarChart2} label="Orcamentos" value={dashboardModel.metrics.pendingBudgets} helper="propostas pendentes" tone="warning" density="compact" />
      </div>

      <QuickActions properties={properties} isLoading={isLoadingDashboard} />

      <PipelineSummary stages={dashboardModel.pipeline} isLoading={isLoadingDashboard} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
        <PropertiesSection properties={properties} isLoading={isLoadingDashboard} />
        <CriticalPendingList items={dashboardModel.criticalPendings} isLoading={isLoadingDashboard} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <AgendaSection schedule={todaySchedule} isLoading={servicesLoading} />
        <RecentActivityList items={dashboardModel.activities} isLoading={isLoadingDashboard} />
      </div>
    </PageContainer>
  );
}
