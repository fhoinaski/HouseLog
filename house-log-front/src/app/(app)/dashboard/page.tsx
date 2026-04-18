'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  ClipboardPen,
  FileText,
  MapPin,
  Settings,
  TrendingUp,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  apiFetcher,
  type CursorPage,
  expensesApi,
  type Property,
  propertiesApi,
  type ServiceOrder,
} from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type ExpenseSummaryDTO = Awaited<ReturnType<typeof expensesApi.summary>>;
type PropertyDashboardDTO = Awaited<ReturnType<typeof propertiesApi.dashboard>>;

function startMonthOffset(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 7);
}

function formatCompactBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function toMonthNumber(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number);
  return y * 12 + m;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const startMonth = useMemo(() => startMonthOffset(6), []);

  const {
    data: properties,
    isLoading: propertiesLoading,
  } = usePagination<Property>('/properties');

  const propertyIds = useMemo(() => properties.map((item) => item.id), [properties]);

  const { data: dashboardsByProperty } = useSWR(
    propertyIds.length ? ['dashboards', ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (id) => {
          const dashboard = await propertiesApi.dashboard(id);
          return [id, dashboard] as const;
        })
      );
      return new Map<string, PropertyDashboardDTO>(entries);
    }
  );

  const { data: summariesByProperty } = useSWR(
    propertyIds.length ? ['expense-summaries', currentMonth, ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (id) => {
          const summary = await expensesApi.summary(id, { from: startMonth, to: currentMonth });
          return [id, summary] as const;
        })
      );
      return new Map<string, ExpenseSummaryDTO>(entries);
    }
  );

  const { data: pendingServicesByProperty } = useSWR(
    propertyIds.length ? ['pending-services', ...propertyIds] : null,
    async () => {
      const entries = await Promise.all(
        propertyIds.map(async (id) => {
          const requested = await apiFetcher<CursorPage<ServiceOrder>>(
            `/properties/${id}/services?status=requested&limit=3`
          );
          return [id, requested.data] as const;
        })
      );
      return new Map<string, ServiceOrder[]>(entries);
    }
  );

  const propertiesCount = properties.length;

  const totalPortfolioRevenue = useMemo(
    () => Array.from(summariesByProperty?.values() ?? []).reduce((acc, summary) => acc + (summary.total_revenue ?? 0), 0),
    [summariesByProperty]
  );

  const pendingOrdersCount = useMemo(
    () => Array.from(dashboardsByProperty?.values() ?? []).reduce((acc, item) => acc + item.services.requested + item.services.in_progress, 0),
    [dashboardsByProperty]
  );

  const allRevenueByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const summary of summariesByProperty?.values() ?? []) {
      for (const month of summary.by_month_revenue ?? []) {
        map.set(month.reference_month, (map.get(month.reference_month) ?? 0) + month.total);
      }
    }
    return map;
  }, [summariesByProperty]);

  const revenueTrend = useMemo(() => {
    const orderedMonths = Array.from(allRevenueByMonth.entries())
      .sort(([a], [b]) => toMonthNumber(a) - toMonthNumber(b));

    if (orderedMonths.length < 2) return null;

    const half = Math.floor(orderedMonths.length / 2);
    const previous = orderedMonths.slice(0, half).reduce((acc, [, value]) => acc + value, 0);
    const current = orderedMonths.slice(half).reduce((acc, [, value]) => acc + value, 0);

    if (previous <= 0) return null;
    return ((current - previous) / previous) * 100;
  }, [allRevenueByMonth]);

  const propertyCards = useMemo(
    () => properties.map((property) => {
      const health = dashboardsByProperty?.get(property.id)?.health_score ?? property.health_score;
      const monthRevenue = summariesByProperty
        ?.get(property.id)
        ?.by_month_revenue
        ?.find((item) => item.reference_month === currentMonth)?.total ?? 0;

      return {
        ...property,
        health,
        monthRevenue,
      };
    }),
    [properties, dashboardsByProperty, summariesByProperty, currentMonth]
  );

  const actionRequired = useMemo(() => {
    const propertyNameMap = new Map(properties.map((p) => [p.id, p.name]));

    const rows: Array<{
      id: string;
      propertyId: string;
      serviceId: string;
      title: string;
      subtitle: string;
      cta: string;
      icon: 'wrench' | 'document';
      highlight?: boolean;
    }> = [];

    for (const [propertyId, orders] of pendingServicesByProperty ?? []) {
      for (const order of orders.slice(0, 2)) {
        const propertyName = propertyNameMap.get(propertyId) ?? 'Imóvel';
        rows.push({
          id: `${propertyId}-${order.id}`,
          propertyId,
          serviceId: order.id,
          title: order.title,
          subtitle: `${propertyName} • OS-${order.id.slice(0, 4)}`,
          cta: 'Review',
          icon: order.priority === 'urgent' ? 'wrench' : 'document',
          highlight: order.priority === 'urgent',
        });
      }
    }

    return rows.slice(0, 2);
  }, [pendingServicesByProperty, properties]);

  const headerInitial = user?.name?.charAt(0) ?? 'U';
  const trendText =
    revenueTrend == null
      ? 'Sem base histórica para comparar'
      : `${revenueTrend >= 0 ? '+' : ''}${revenueTrend.toFixed(1)}% vs período anterior`;

  return (
    <div className="relative -mx-4 -mt-4 min-h-screen bg-background pb-36 pt-24 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="fixed inset-x-0 top-0 z-50 bg-linear-to-b from-(--surface-container-low)/95 to-transparent px-6 py-4 backdrop-blur-3xl shadow-[0_40px_60px_-15px_rgba(6,14,32,0.4)]">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between md:max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-(--outline-variant)/30 bg-(--surface-variant)">
              <span className="text-sm font-bold text-(--on-surface)">{headerInitial}</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-primary">HouseLog</h1>
          </div>

          <button className="relative flex h-10 w-10 items-center justify-center rounded-full text-primary transition-all duration-200 hover:bg-(--surface-variant)/50 active:scale-95">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-amber-400" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-lg space-y-10 px-6 md:max-w-4xl">
        <section aria-label="Portfolio Summary">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 relative overflow-hidden rounded-xl bg-(--surface-container-low) p-6">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary-700/10 to-transparent" />
              <div className="relative z-10 flex flex-col">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-(--on-surface-variant)">Portfolio Value</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black tracking-[-0.05em] text-primary">{formatCompactBRL(totalPortfolioRevenue)}</span>
                </div>
                <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', revenueTrend != null && revenueTrend >= 0 ? 'text-secondary' : 'text-amber-400')}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{trendText}</span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-(--surface-container-low) p-5">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.05em] text-(--on-surface-variant)">Properties</span>
              <span className="mb-1 block text-5xl font-extrabold tracking-tight text-(--on-surface)">{propertiesLoading ? '...' : propertiesCount}</span>
              <span className="text-xs text-(--on-surface-variant)">Active Units</span>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-(--surface-container-low) p-5">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-700/10 to-transparent" />
              <div className="relative flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-(--on-surface-variant)">Services</span>
                <span className="relative mt-1 flex h-2 w-2 rounded-full bg-amber-400">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                </span>
              </div>
              <span className="mb-1 mt-2 block text-5xl font-extrabold tracking-tight text-amber-400">{pendingOrdersCount}</span>
              <span className="text-xs text-(--on-surface-variant)">Pending OS</span>
            </div>
          </div>
        </section>

        <section aria-label="Properties">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-bold text-(--on-surface)">Properties</h2>
            <Link href="/properties" className="text-xs font-medium text-primary transition-colors hover:text-primary-300">View All</Link>
          </div>

          <div className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4">
            {propertyCards.map((property) => (
              <div key={property.id} className="relative min-w-70 snap-center overflow-hidden rounded-xl bg-(--surface-container-low) shadow-[0_40px_60px_-15px_rgba(6,14,32,0.4)]">
                <div className="relative h-32">
                  {property.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={property.cover_url} alt={property.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-linear-to-br from-primary-700/35 to-zinc-700" />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-(--surface-container-low) to-transparent" />
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-(--outline-variant)/30 bg-(--surface-variant)/60 px-2 py-1 backdrop-blur-md">
                    <span className={cn('h-1.5 w-1.5 rounded-full', property.health >= 80 ? 'bg-secondary' : property.health >= 60 ? 'bg-primary' : 'bg-tertiary')} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-(--on-surface)">{property.health}% Health</span>
                  </div>
                </div>

                <div className="relative p-5 pt-2">
                  <h3 className="mb-1 text-4xl font-bold leading-tight text-(--on-surface)">{property.name}</h3>
                  <p className="mb-4 flex items-center gap-1 text-xs text-(--on-surface-variant)">
                    <MapPin className="h-3.5 w-3.5" />
                    {property.city}
                  </p>

                  <div className="flex items-end justify-between border-t border-(--outline-variant)/20 pt-3">
                    <div>
                      <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-(--on-surface-variant)">Monthly Rev</span>
                      <span className="text-3xl font-semibold text-primary">{formatCurrency(property.monthRevenue)}</span>
                    </div>
                    <Link href={`/properties/${property.id}`} className="text-(--on-surface-variant) transition-colors hover:text-primary">
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Pending Actions">
          <h2 className="mb-4 text-xl font-bold text-(--on-surface)">Action Required</h2>
          <div className="space-y-3">
            {actionRequired.map((action) => (
              <div key={action.id} className="flex items-center gap-4 rounded-lg border border-(--outline-variant)/20 bg-(--surface-container-low) p-4 shadow-[0_20px_40px_-10px_rgba(6,14,32,0.3)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  {action.icon === 'wrench' ? <Wrench className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-lg font-semibold text-(--on-surface)">{action.title}</h4>
                  <p className="truncate text-xs text-(--on-surface-variant)">{action.subtitle}</p>
                </div>
                <Link
                  href={`/properties/${action.propertyId}/services/${action.serviceId}`}
                  className="rounded-md bg-(--surface-variant)/45 px-3 py-1.5 text-xs font-semibold text-(--on-surface) transition-colors hover:bg-(--surface-bright)"
                >
                  {action.cta}
                </Link>
              </div>
            ))}

            {actionRequired.length === 0 && (
              <div className="rounded-lg bg-(--surface-container-high) p-4">
                <p className="text-sm text-(--on-surface-variant)">Nenhuma ação pendente no momento.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <nav
        className="fixed left-1/2 z-50 flex w-[92%] max-w-lg -translate-x-1/2 items-stretch gap-1 rounded-[1.5rem] bg-(--surface-variant)/60 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:hidden"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <Link href="/dashboard" className="flex flex-1 min-w-0 flex-col items-center justify-center rounded-xl bg-primary/10 px-1 py-2 text-primary">
          <Building2 className="mb-1 h-5 w-5" />
          <span className="max-w-full truncate text-center text-[10px] font-bold uppercase tracking-[0.05em]">Home</span>
        </Link>
        <Link href="/properties" className="flex flex-1 min-w-0 flex-col items-center justify-center px-1 py-2 text-(--outline-variant) transition-colors hover:text-secondary">
          <ClipboardPen className="mb-1 h-5 w-5" />
          <span className="max-w-full truncate text-center text-[10px] font-bold uppercase tracking-[0.05em]">Propriedades</span>
        </Link>
        <Link href="/properties" className="flex flex-1 min-w-0 flex-col items-center justify-center px-1 py-2 text-(--outline-variant) transition-colors hover:text-secondary">
          <Wallet className="mb-1 h-5 w-5" />
          <span className="max-w-full truncate text-center text-[10px] font-bold uppercase tracking-[0.05em]">Financeiro</span>
        </Link>
        <Link href="/settings" className="flex flex-1 min-w-0 flex-col items-center justify-center px-1 py-2 text-(--outline-variant) transition-colors hover:text-secondary">
          <Settings className="mb-1 h-5 w-5" />
          <span className="max-w-full truncate text-center text-[10px] font-bold uppercase tracking-[0.05em]">Configurações</span>
        </Link>
      </nav>
    </div>
  );
}
