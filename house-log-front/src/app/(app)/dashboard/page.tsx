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

function getPlaceholderColor(name: string): string {
  const colors = [
    'from-[#CBD5E1] to-[#94A3B8]',
    'from-[#A7C4A0] to-[#6B9E63]',
    'from-[#C4B5A0] to-[#8B7355]',
    'from-[#A0B4C4] to-[#5B7F99]',
    'from-[#C4A0B4] to-[#99537F]',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
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
          <div className="
            h-13 w-13 rounded-[14px] bg-[#F3F4F6]
            flex items-center justify-center
            transition-colors duration-150 group-hover:bg-[#E5E7EB]
          ">
            <Icon size={22} strokeWidth={1.8} className="text-zinc-700" />
          </div>
          <span className="text-center text-[11px] leading-tight whitespace-nowrap text-[#6B7280]">
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
      <div className="h-13 w-13 overflow-hidden rounded-[10px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }
  const gradient = getPlaceholderColor(name);
  const initials = getInitials(name);
  return (
    <div className={`
      h-13 w-13 rounded-[10px] shrink-0
      bg-linear-to-br ${gradient}
      flex items-center justify-center
    `}>
      <span className="text-[13px] font-medium text-white/90">{initials}</span>
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
        <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#6B7280]">
          Imóveis Gerenciados
        </span>
        <Link
          href="/properties"
          className="text-[13px] font-medium text-[#F59E0B] hover:underline"
        >
          Ver todos
        </Link>
      </div>

      <div className="rounded-xl bg-[#F9FAFB] px-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
              <div className="h-13 w-13 rounded-[10px] bg-[#E5E7EB] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[#E5E7EB] animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-[#E5E7EB] animate-pulse" />
              </div>
            </div>
          ))
        ) : properties.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-[#9CA3AF]">Nenhum imóvel cadastrado</p>
            <Link href="/properties/new" className="mt-1 block text-[13px] font-medium text-[#1A2332] hover:underline">
              Adicionar imóvel
            </Link>
          </div>
        ) : (
          properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="-mx-3 flex items-center gap-3 rounded-xl border-b border-[#F3F4F6] px-3 py-3 transition-colors hover:bg-white/60 last:border-b-0"
            >
              <PropertyThumbnail
                name={property.name}
                photoUrl={property.coverPhotoUrl ?? property.photoUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-zinc-900">
                  {property.name}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-[#6B7280]">
                  {property.address}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {property.activeServicesCount > 0 && (
                  <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium text-[#92400E]">
                    {property.activeServicesCount} OS
                  </span>
                )}
                {property.completedServicesCount > 0 && (
                  <span className="rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-medium text-[#065F46]">
                    {property.completedServicesCount} OK
                  </span>
                )}
                {property.activeServicesCount === 0 && property.completedServicesCount === 0 && (
                  <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#9CA3AF]">
                    0 OS
                  </span>
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
        <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#6B7280]">
          Orçamentos para Analisar
        </span>
        {bids.length > 0 && (
          <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium text-[#92400E]">
            {bids.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#FFFBEB] p-3 animate-pulse">
              <div className="mb-2 h-4 w-2/3 rounded bg-[#FEF3C7]" />
              <div className="h-3 w-1/2 rounded bg-[#FEF3C7]" />
            </div>
          ))}
        </div>
      ) : bids.length === 0 ? (
        <div className="rounded-xl bg-[#F9FAFB] py-8 text-center">
          <p className="text-[13px] text-[#9CA3AF]">Nenhum orçamento pendente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bids.map((bid) => (
            <Link
              key={bid.id}
              href={`/properties/${bid.propertyId}/services/${bid.serviceOrderId}`}
              className="block rounded-xl bg-[#FFFBEB] p-3 transition-colors hover:bg-[#FEF3C7]/60"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="leading-snug text-[14px] font-medium text-zinc-900">
                  {bid.title}
                </p>
                <span className="mt-0.5 shrink-0 text-[11px] text-[#9CA3AF]">
                  {new Date(bid.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
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
        <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#6B7280]">
          Agenda de Hoje
        </span>
      </div>

      <div className="rounded-xl bg-[#F9FAFB] px-3">
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
                <div className="h-9 w-0.75 rounded-sm bg-[#E5E7EB] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-[#F3F4F6] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[#F3F4F6] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : schedule.length === 0 ? (
          <div className="flex items-center gap-3 py-4">
            <CalendarCheck size={18} strokeWidth={1.8} className="text-[#D1D5DB]" />
            <p className="text-[13px] text-[#9CA3AF]">
              Nenhum serviço agendado para hoje
            </p>
          </div>
        ) : (
          <div>
            {schedule.map((item, i) => (
              <Link
                key={item.id ?? i}
                href={`/properties/${item.propertyId}/services/${item.serviceOrderId}`}
                className="-mx-1 flex items-center gap-3 rounded-lg border-b border-[#F3F4F6] px-1 py-3 transition-colors hover:bg-[#F9FAFB] last:border-b-0"
              >
                <div
                  className="h-9 w-0.75 shrink-0 rounded-sm"
                  style={{
                    background: item.status === 'confirmed' || item.status === 'in_progress'
                      ? '#4EDEA3'
                      : '#F59E0B',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-zinc-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    {item.time} · {item.propertyName}
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={1.8} className="shrink-0 text-[#D1D5DB]" />
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
    <div className="mx-auto max-w-300 px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-8">
      <div className="mb-6 md:mb-8">
        <p className="text-[14px] text-[#6B7280]">{getGreeting()}</p>
        <h1 className="mt-0.5 text-[24px] md:text-[28px] font-medium tracking-tight leading-tight text-zinc-900">
          {firstName}
        </h1>
        <p className="mt-1 text-[13px] capitalize text-[#9CA3AF]">
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
