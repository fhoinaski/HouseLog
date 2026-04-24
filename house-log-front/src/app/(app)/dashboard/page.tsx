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
  FilePlus,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { propertiesApi, servicesApi, type Property, type ServiceOrder } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

type PropertyListItem = Property & {
  activeServicesCount: number;
  completedServicesCount: number;
  coverPhotoUrl?: string;
  photoUrl?: string;
};

type BidItem = {
  id: string;
  serviceOrderId: string;
  propertyId: string;
  title: string;
  providerName: string;
  amount: number | null;
  createdAt: string;
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

function BidsSection({ bids, isLoading }: { bids: BidItem[]; isLoading: boolean }) {
  return (
    <PageSection
      title="Orcamentos para analisar"
      description="Decisoes pendentes conectadas a ordens de servico reais."
      tone="strong"
      density="editorial"
      actions={bids.length > 0 ? <Badge variant="requested">{bids.length}</Badge> : null}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      ) : bids.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="Nenhum orcamento pendente"
          description="Quando houver uma OS para aprovacao, ela aparecera aqui."
          tone="subtle"
        />
      ) : (
        <div className="space-y-2">
          {bids.map((bid) => (
            <Link
              key={bid.id}
              href={`/properties/${bid.propertyId}/services/${bid.serviceOrderId}`}
              className="block rounded-[var(--radius-lg)] bg-bg-warning p-4 transition-colors hover:bg-bg-warning-emphasis focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug text-text-primary">{bid.title}</p>
                <span className="mt-0.5 shrink-0 text-xs text-text-tertiary">
                  {new Date(bid.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {bid.providerName}
                {bid.amount !== null ? ` - ${formatCurrency(Number(bid.amount))}` : ' - Sem valor'}
              </p>
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

  const { data: propertiesData, isLoading: propertiesLoading } = useSWR(
    user ? 'properties' : null,
    () => propertiesApi.list(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const baseProperties = useMemo(() => propertiesData?.data ?? [], [propertiesData]);
  const propertyIds = useMemo(() => baseProperties.map((property) => property.id), [baseProperties]);

  const { data: servicesMap, isLoading: servicesLoading } = useSWR(
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

  const properties = useMemo<PropertyListItem[]>(() => {
    return baseProperties.map((property) => {
      const items = servicesMap?.get(property.id) ?? [];
      const activeServicesCount = items.filter((item) => ['requested', 'approved', 'in_progress'].includes(item.status)).length;
      const completedServicesCount = items.filter((item) => ['completed', 'verified'].includes(item.status)).length;
      return { ...property, activeServicesCount, completedServicesCount };
    });
  }, [baseProperties, servicesMap]);

  const pendingBids = useMemo<BidItem[]>(() => {
    const rows: BidItem[] = [];
    servicesMap?.forEach((services) => {
      services
        .filter((service) => service.status === 'requested')
        .forEach((service) => {
          rows.push({
            id: service.id,
            serviceOrderId: service.id,
            propertyId: service.property_id,
            title: service.title ?? 'Sem titulo',
            providerName: service.assigned_to_name ?? 'Prestador pendente',
            amount: service.cost,
            createdAt: service.created_at,
          });
        });
    });
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  }, [servicesMap]);

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

  const activeServices = properties.reduce((sum, property) => sum + property.activeServicesCount, 0);
  const completedServices = properties.reduce((sum, property) => sum + property.completedServicesCount, 0);
  const firstName = user?.name?.split(' ')[0] ?? 'voce';
  const isLoadingDashboard = propertiesLoading || servicesLoading;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-4 py-4 md:px-6 md:py-6 md:pb-8">
      <PageHeader
        density="editorial"
        eyebrow="The Architectural Lens"
        title={`${getGreeting()} ${firstName}`}
        description="Visao operacional dos imoveis, ordens de servico e decisoes pendentes em uma leitura rapida."
        actions={
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface-strong)] px-4 py-3 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">{formatDashboardDate()}</p>
            <p className="mt-1 text-sm text-text-secondary">{activeServices} OS abertas</p>
          </div>
        }
      />

      <PageSection tone="strong" density="editorial">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Sistema operacional privado</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight text-text-primary md:text-3xl">
              Clareza tecnica para cada decisao do imovel.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              Acompanhe portfolio, demandas abertas, agenda e aprovacoes sem sair do contexto real dos ativos.
            </p>
          </div>

          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Lente operacional</p>
            <p className="mt-2 text-2xl font-medium leading-tight text-text-primary">{activeServices} OS abertas</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {pendingBids.length > 0
                ? `${pendingBids.length} orcamento(s) precisam de analise.`
                : 'Sem orcamentos pendentes para aprovacao.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={todaySchedule.length > 0 ? 'approved' : 'normal'}>{todaySchedule.length} hoje</Badge>
              <Badge variant={activeServices > 0 ? 'in_progress' : 'normal'}>{properties.length} imoveis</Badge>
            </div>
          </div>
        </div>
      </PageSection>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={Building2} label="Imoveis" value={properties.length} helper={properties.length === 1 ? 'ativo monitorado' : 'ativos monitorados'} tone="accent" />
        <MetricCard icon={ClipboardCheck} label="OS abertas" value={activeServices} helper={activeServices === 1 ? 'demanda em andamento' : 'demandas em andamento'} tone="warning" />
        <MetricCard icon={Clock3} label="Hoje" value={todaySchedule.length} helper={todaySchedule.length === 1 ? 'visita agendada' : 'visitas agendadas'} tone="default" />
        <MetricCard icon={CalendarCheck} label="Concluidas" value={completedServices} helper={completedServices === 1 ? 'servico finalizado' : 'servicos finalizados'} tone="success" />
      </div>

      <QuickActions properties={properties} isLoading={isLoadingDashboard} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
        <PropertiesSection properties={properties} isLoading={isLoadingDashboard} />
        <BidsSection bids={pendingBids} isLoading={servicesLoading} />
      </div>

      <AgendaSection schedule={todaySchedule} isLoading={servicesLoading} />
    </div>
  );
}
