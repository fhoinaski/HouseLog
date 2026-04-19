'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  FilePlus,
  CalendarDays,
  Package,
  BarChart2,
  ChevronRight,
  CalendarCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { propertiesApi, servicesApi, type Property, type ServiceOrder } from '@/lib/api';

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

function formatDate() {
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
  { label: 'Nova OS', icon: FilePlus, href: '/properties' },
  { label: 'Agendar', icon: CalendarDays, href: '/schedule' },
  { label: 'Inventário', icon: Package, href: '/properties' },
  { label: 'Relatórios', icon: BarChart2, href: '/financial' },
];

function QuickActions() {
  return (
    <div className="grid w-fit max-w-[320px] grid-cols-4 gap-4 md:gap-5">
      {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col items-center gap-2"
        >
          <div className="flex h-13 w-13 items-center justify-center rounded-[14px] bg-bg-subtle transition-colors duration-150 group-hover:bg-bg-muted">
            <Icon size={22} strokeWidth={1.8} className="text-text-secondary" />
          </div>
          <span className="whitespace-nowrap text-center text-xs leading-tight text-text-secondary">
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}

function PropertyThumbnail({ name, photoUrl }: { name: string; photoUrl?: string }) {
  if (photoUrl) {
    return (
      <div className="h-13 w-13 shrink-0 overflow-hidden rounded-[10px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }
  const initials = getInitials(name);
  return (
    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[10px] bg-bg-accent-subtle">
      <span className="text-sm font-medium text-text-accent">{initials}</span>
    </div>
  );
}

function PropertiesSection({ properties, isLoading }: {
  properties: PropertyListItem[];
  isLoading: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="hl-section-title">Imóveis gerenciados</span>
        <Link href="/properties" className="text-sm font-medium text-text-accent hover:underline">
          Ver todos
        </Link>
      </div>

      <div className="rounded-xl bg-bg-subtle px-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border-subtle py-3 last:border-b-0">
              <div className="hl-skeleton h-13 w-13 shrink-0 rounded-[10px]" />
              <div className="flex-1 space-y-2">
                <div className="hl-skeleton h-4 w-3/4 rounded" />
                <div className="hl-skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))
        ) : properties.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-tertiary">Nenhum imóvel cadastrado</p>
            <Link href="/properties/new" className="mt-1 block text-sm font-medium text-text-primary hover:underline">
              Adicionar imóvel
            </Link>
          </div>
        ) : (
          properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="-mx-3 flex items-center gap-3 rounded-xl border-b border-border-subtle px-3 py-3 transition-colors hover:bg-bg-surface last:border-b-0"
            >
              <PropertyThumbnail
                name={property.name}
                photoUrl={property.coverPhotoUrl ?? property.photoUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-md font-medium text-text-primary">
                  {property.name}
                </p>
                <p className="mt-0.5 truncate text-sm text-text-secondary">
                  {property.address}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {property.activeServicesCount > 0 && (
                  <span className="hl-badge hl-badge-pending">
                    {property.activeServicesCount} OS
                  </span>
                )}
                {property.completedServicesCount > 0 && (
                  <span className="hl-badge hl-badge-done">
                    {property.completedServicesCount} OK
                  </span>
                )}
                {property.activeServicesCount === 0 && property.completedServicesCount === 0 && (
                  <span className="hl-badge hl-badge-draft">0 OS</span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function BidsSection({ bids, isLoading }: {
  bids: BidItem[];
  isLoading: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="hl-section-title">Orçamentos para analisar</span>
        {bids.length > 0 && (
          <span className="hl-badge hl-badge-pending">{bids.length}</span>
        )}
      </div>

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
        <div className="rounded-xl bg-bg-subtle py-8 text-center">
          <p className="text-sm text-text-tertiary">Nenhum orçamento pendente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bids.map((bid) => (
            <Link
              key={bid.id}
              href={`/properties/${bid.propertyId}/services/${bid.serviceOrderId}`}
              className="block rounded-xl bg-bg-warning p-3 transition-colors hover:bg-bg-warning-emphasis"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-medium leading-snug text-text-primary">
                  {bid.title}
                </p>
                <span className="mt-0.5 shrink-0 text-xs text-text-tertiary">
                  {new Date(bid.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {bid.providerName}
                {bid.amount !== null
                  ? ` · R$ ${Number(bid.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : ' · Sem valor'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaSection({ schedule, isLoading }: {
  schedule: ScheduleItem[];
  isLoading: boolean;
}) {
  return (
    <div>
      <div className="mb-3">
        <span className="hl-section-title">Agenda de hoje</span>
      </div>

      <div className="rounded-xl bg-bg-subtle px-3">
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border-subtle py-3 last:border-b-0">
                <div className="hl-skeleton h-9 w-0.75 shrink-0 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <div className="hl-skeleton h-4 w-2/3 rounded" />
                  <div className="hl-skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : schedule.length === 0 ? (
          <div className="flex items-center gap-3 py-4">
            <CalendarCheck size={18} strokeWidth={1.8} className="text-text-disabled" />
            <p className="text-sm text-text-tertiary">
              Nenhum serviço agendado para hoje
            </p>
          </div>
        ) : (
          <div>
            {schedule.map((item, i) => (
              <Link
                key={item.id ?? i}
                href={`/properties/${item.propertyId}/services/${item.serviceOrderId}`}
                className="-mx-1 flex items-center gap-3 rounded-lg border-b border-border-subtle px-1 py-3 transition-colors hover:bg-bg-surface last:border-b-0"
              >
                <div
                  className="h-9 w-0.75 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: item.status === 'confirmed' || item.status === 'in_progress'
                      ? 'var(--primitive-success-600)'
                      : 'var(--text-warning)',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-text-primary">
                    {item.title}
                  </p>
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
    </div>
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

  const {
    data: propertiesData,
    isLoading: propertiesLoading,
  } = useSWR(
    user ? 'properties' : null,
    () => propertiesApi.list(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      errorRetryCount: 3,
    }
  );

  const baseProperties = useMemo(
    () => propertiesData?.data ?? [],
    [propertiesData]
  );

  const propertyIds = useMemo(
    () => baseProperties.map((p) => p.id),
    [baseProperties]
  );

  const {
    data: servicesMap,
    isLoading: servicesLoading,
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

  const properties = useMemo<PropertyListItem[]>(() => {
    return baseProperties.map((property) => {
      const items = servicesMap?.get(property.id) ?? [];
      const activeServicesCount = items.filter((s) => ['requested', 'approved', 'in_progress'].includes(s.status)).length;
      const completedServicesCount = items.filter((s) => ['completed', 'verified'].includes(s.status)).length;
      return {
        ...property,
        activeServicesCount,
        completedServicesCount,
      };
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
    return rows
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
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
              : '—',
            propertyName,
            status: s.status === 'in_progress' ? 'in_progress' : s.status === 'approved' ? 'confirmed' : 'pending',
          });
        });
    });

    return rows
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 8);
  }, [baseProperties, servicesMap]);

  const firstName = user?.name?.split(' ')[0] ?? 'você';

  return (
    <div className="mx-auto max-w-300 px-4 py-4 safe-bottom md:px-6 md:py-6 md:pb-8">
      <div className="mb-6 md:mb-8">
        <p className="text-base text-text-secondary">{getGreeting()}</p>
        <h1 className="mt-0.5 text-2xl font-medium leading-tight tracking-tight text-text-primary md:text-3xl">
          {firstName}
        </h1>
        <p className="mt-1 text-sm capitalize text-text-tertiary">
          {formatDate()}
        </p>
      </div>

      <div className="mb-6 md:mb-8">
        <QuickActions />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:mb-8 md:grid-cols-5 md:gap-8">
        <div className="md:col-span-3">
          <PropertiesSection
            properties={properties}
            isLoading={propertiesLoading || servicesLoading}
          />
        </div>
        <div className="md:col-span-2">
          <BidsSection
            bids={pendingBids}
            isLoading={servicesLoading}
          />
        </div>
      </div>

      <AgendaSection
        schedule={todaySchedule}
        isLoading={servicesLoading}
      />
    </div>
  );
}
