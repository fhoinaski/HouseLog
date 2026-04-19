'use client';

import { type ReactNode, useMemo } from 'react';
import Link from 'next/link';
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
import { useAuth } from '@/lib/auth-context';
import { propertiesApi, servicesApi, type Property, type ServiceOrder } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type MetricItem = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
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
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const QUICK_ACTIONS = [
  { label: 'Nova OS', description: 'Abrir demanda', icon: FilePlus, href: '/properties' },
  { label: 'Agendar', description: 'Organizar visita', icon: CalendarDays, href: '/schedule' },
  { label: 'Inventário', description: 'Mapear ativos', icon: Package, href: '/properties' },
  { label: 'Relatórios', description: 'Ver finanças', icon: BarChart2, href: '/financial' },
];

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">{eyebrow}</p>
        <CardTitle className="mt-1 text-lg leading-tight">{title}</CardTitle>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-36 place-items-center rounded-xl bg-[var(--surface-base)] px-4 py-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-strong)]">
          <Icon className="h-5 w-5 text-text-tertiary" strokeWidth={1.8} />
        </div>
        <p className="mt-3 text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-sm leading-6 text-text-tertiary">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: MetricItem) {
  return (
    <Card variant="raised" density="compact" className="min-h-28">
      <CardContent className="flex h-full flex-col justify-between p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-tonal-bg)]">
            <Icon className="h-4 w-4 text-text-accent" strokeWidth={1.8} />
          </div>
        </div>
        <div>
          <p className="text-2xl font-medium leading-none text-text-primary">{value}</p>
          <p className="mt-2 text-sm leading-5 text-text-secondary">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card variant="tonal" density="comfortable">
      <CardHeader className="pb-3">
        <SectionHeading eyebrow="Ações rápidas" title="Operação sem atrito" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map(({ label, description, icon: Icon, href }) => (
            <Link
              key={`${href}-${label}`}
              href={href}
              className="group rounded-xl bg-[var(--surface-base)] p-3 shadow-[var(--shadow-xs)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
            >
              <div className="flex min-h-24 flex-col justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-tonal-bg)] transition-colors group-hover:bg-[var(--button-tonal-hover)]">
                  <Icon className="h-5 w-5 text-text-accent" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-text-tertiary">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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

function PropertiesSection({ properties, isLoading }: { properties: PropertyListItem[]; isLoading: boolean }) {
  return (
    <Card variant="tonal" density="comfortable" className="h-full">
      <CardHeader className="pb-3">
        <SectionHeading
          eyebrow="Portfólio"
          title="Imóveis gerenciados"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/properties">Ver todos</Link>
            </Button>
          }
        />
      </CardHeader>

      <CardContent>
        <div className="rounded-xl bg-[var(--surface-base)] p-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-3">
                <div className="hl-skeleton h-[52px] w-[52px] shrink-0 rounded-[var(--radius-md)]" />
                <div className="flex-1 space-y-2">
                  <div className="hl-skeleton h-4 w-3/4 rounded" />
                  <div className="hl-skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))
          ) : properties.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhum imóvel cadastrado"
              description="Comece criando o primeiro ativo para liberar visão operacional."
              action={
                <Button asChild variant="tonal" size="sm">
                  <Link href="/properties/new">Adicionar imóvel</Link>
                </Button>
              }
            />
          ) : (
            properties.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--surface-strong)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
              >
                <PropertyThumbnail name={property.name} photoUrl={property.coverPhotoUrl ?? property.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-md font-medium text-text-primary">{property.name}</p>
                  <p className="mt-0.5 truncate text-sm text-text-secondary">{property.address}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {property.activeServicesCount > 0 && <Badge variant="requested">{property.activeServicesCount} OS</Badge>}
                  {property.completedServicesCount > 0 && <Badge variant="completed">{property.completedServicesCount} OK</Badge>}
                  {property.activeServicesCount === 0 && property.completedServicesCount === 0 && <Badge variant="normal">0 OS</Badge>}
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BidsSection({ bids, isLoading }: { bids: BidItem[]; isLoading: boolean }) {
  return (
    <Card variant="tonal" density="comfortable" className="h-full">
      <CardHeader className="pb-3">
        <SectionHeading
          eyebrow="Decisão"
          title="Orçamentos para analisar"
          action={bids.length > 0 ? <Badge variant="requested">{bids.length}</Badge> : null}
        />
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="hl-skeleton rounded-xl p-3">
                <div className="mb-2 h-4 w-2/3 rounded" />
                <div className="h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : bids.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhum orçamento pendente"
            description="Quando houver uma OS para aprovação, ela aparece aqui."
          />
        ) : (
          <div className="space-y-2">
            {bids.map((bid) => (
              <Link
                key={bid.id}
                href={`/properties/${bid.propertyId}/services/${bid.serviceOrderId}`}
                className="block rounded-xl bg-bg-warning p-3 transition-colors hover:bg-bg-warning-emphasis focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-medium leading-snug text-text-primary">{bid.title}</p>
                  <span className="mt-0.5 shrink-0 text-xs text-text-tertiary">
                    {new Date(bid.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {bid.providerName}
                  {bid.amount !== null ? ` · ${formatCurrency(Number(bid.amount))}` : ' · Sem valor'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgendaSection({ schedule, isLoading }: { schedule: ScheduleItem[]; isLoading: boolean }) {
  return (
    <Card variant="tonal" density="comfortable">
      <CardHeader className="pb-3">
        <SectionHeading eyebrow="Agenda" title="Agenda de hoje" />
      </CardHeader>

      <CardContent>
        <div className="rounded-xl bg-[var(--surface-base)] p-2">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-3">
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
              icon={CalendarCheck}
              title="Nenhum serviço agendado para hoje"
              description="A operação do dia está livre de visitas programadas."
            />
          ) : (
            <div>
              {schedule.map((item, i) => (
                <Link
                  key={item.id ?? i}
                  href={`/properties/${item.propertyId}/services/${item.serviceOrderId}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--surface-strong)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                >
                  <div
                    className={cn(
                      'h-9 w-1 shrink-0 rounded-sm',
                      item.status === 'confirmed' || item.status === 'in_progress' ? 'bg-text-success' : 'bg-text-warning'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-text-primary">{item.title}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {item.time} · {item.propertyName}
                    </p>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.8} className="shrink-0 text-text-disabled" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
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
  const propertyIds = useMemo(() => baseProperties.map((p) => p.id), [baseProperties]);

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
      const activeServicesCount = items.filter((s) => ['requested', 'approved', 'in_progress'].includes(s.status)).length;
      const completedServicesCount = items.filter((s) => ['completed', 'verified'].includes(s.status)).length;
      return { ...property, activeServicesCount, completedServicesCount };
    });
  }, [baseProperties, servicesMap]);

  const pendingBids = useMemo<BidItem[]>(() => {
    const rows: BidItem[] = [];
    servicesMap?.forEach((services) => {
      services
        .filter((s) => s.status === 'requested')
        .forEach((s) => {
          rows.push({
            id: s.id,
            serviceOrderId: s.id,
            propertyId: s.property_id,
            title: s.title ?? 'Sem título',
            providerName: s.assigned_to_name ?? 'Prestador pendente',
            amount: s.cost,
            createdAt: s.created_at,
          });
        });
    });
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  }, [servicesMap]);

  const todaySchedule = useMemo<ScheduleItem[]>(() => {
    const byProperty = new Map(baseProperties.map((p) => [p.id, p.name] as const));
    const rows: ScheduleItem[] = [];

    servicesMap?.forEach((services, propertyId) => {
      const propertyName = byProperty.get(propertyId) ?? 'Imóvel';
      services
        .filter((s) => isToday(s.scheduled_at))
        .forEach((s) => {
          rows.push({
            id: s.id,
            serviceOrderId: s.id,
            propertyId,
            title: s.title,
            time: s.scheduled_at
              ? new Date(s.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '-',
            propertyName,
            status: s.status === 'in_progress' ? 'in_progress' : s.status === 'approved' ? 'confirmed' : 'pending',
          });
        });
    });

    return rows.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 8);
  }, [baseProperties, servicesMap]);

  const activeServices = properties.reduce((sum, property) => sum + property.activeServicesCount, 0);
  const completedServices = properties.reduce((sum, property) => sum + property.completedServicesCount, 0);
  const firstName = user?.name?.split(' ')[0] ?? 'você';
  const isLoadingDashboard = propertiesLoading || servicesLoading;

  const metrics: MetricItem[] = [
    {
      label: 'Imóveis',
      value: String(properties.length),
      detail: properties.length === 1 ? 'ativo monitorado' : 'ativos monitorados',
      icon: Building2,
    },
    {
      label: 'OS abertas',
      value: String(activeServices),
      detail: activeServices === 1 ? 'demanda em andamento' : 'demandas em andamento',
      icon: ClipboardCheck,
    },
    {
      label: 'Hoje',
      value: String(todaySchedule.length),
      detail: todaySchedule.length === 1 ? 'visita agendada' : 'visitas agendadas',
      icon: Clock3,
    },
    {
      label: 'Concluídas',
      value: String(completedServices),
      detail: completedServices === 1 ? 'serviço finalizado' : 'serviços finalizados',
      icon: CalendarCheck,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5 px-4 py-4 safe-bottom md:px-6 md:py-6 md:pb-8">
      <Card variant="raised" density="comfortable" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--provider-accent)_13%,transparent),transparent_55%)]" />
        <CardContent className="relative grid gap-6 p-5 md:grid-cols-[1.4fr_1fr] md:p-6">
          <div>
            <p className="text-sm text-text-secondary">{getGreeting()}</p>
            <h1 className="mt-1 text-3xl font-medium leading-tight text-text-primary md:text-4xl">{firstName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              Visão operacional dos imóveis, ordens de serviço e decisões pendentes em uma leitura rápida.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
              {formatDashboardDate()}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--surface-base)] p-4 shadow-[var(--shadow-xs)]">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Lente operacional</p>
            <p className="mt-2 text-2xl font-medium leading-tight text-text-primary">{activeServices} OS abertas</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {pendingBids.length > 0
                ? `${pendingBids.length} orçamento(s) precisam de análise.`
                : 'Sem orçamentos pendentes para aprovação.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={todaySchedule.length > 0 ? 'approved' : 'normal'}>{todaySchedule.length} hoje</Badge>
              <Badge variant={activeServices > 0 ? 'in_progress' : 'normal'}>{properties.length} imóveis</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <QuickActions />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr]">
        <PropertiesSection properties={properties} isLoading={isLoadingDashboard} />
        <BidsSection bids={pendingBids} isLoading={servicesLoading} />
      </div>

      <AgendaSection schedule={todaySchedule} isLoading={servicesLoading} />
    </div>
  );
}
