'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, MapPin, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderCard } from '@/components/services/service-order-card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { providerApi, type ProviderServiceOrder } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SERVICE_STATUS_LABELS, SYSTEM_TYPE_LABELS, formatDate } from '@/lib/utils';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested',
  approved: 'approved',
  in_progress: 'in_progress',
  completed: 'completed',
  verified: 'verified',
};

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

const STATUS_FILTERS = ['', 'approved', 'in_progress', 'completed', 'verified'] as const;

export default function ProviderServicesPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useSWR(['provider-services', statusFilter], () =>
    providerApi.services(statusFilter ? { status: statusFilter } : undefined)
  );

  const orders = data?.data ?? [];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Operação privada"
        title="Minhas operações"
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status || 'all'}
            type="button"
            className="hl-chip"
            data-active={statusFilter === status ? 'true' : undefined}
            onClick={() => setStatusFilter(status)}
          >
            {status ? SERVICE_STATUS_LABELS[status] : 'Todas'}
          </button>
        ))}
      </div>

      <PageSection tone="strong">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title="Nenhuma operacao encontrada"
            description="Quando uma ordem de servico for atribuida ou liberada para seu perfil, ela aparecera aqui."
            tone="subtle"
            density="spacious"
          />
        ) : (
          <div className="tap-highlight-none space-y-3">
            {orders.map((order: ProviderServiceOrder) => (
              <Link key={order.id} href={`/provider/services/${order.id}`} className="block">
                <ServiceOrderCard
                  interactive
                  leadingIcon={
                    order.priority === 'urgent' ? (
                      <AlertTriangle className="h-4 w-4 text-text-danger" />
                    ) : (
                      <Wrench className="h-4 w-4" />
                    )
                  }
                  title={order.title}
                  meta={`${SYSTEM_TYPE_LABELS[order.system_type]} - ${SERVICE_STATUS_LABELS[order.status]}`}
                  status={
                    <div className="flex max-w-[10rem] flex-wrap justify-end gap-1.5">
                      <Badge variant={STATUS_VARIANT[order.status]} className="text-xs">
                        {SERVICE_STATUS_LABELS[order.status]}
                      </Badge>
                      <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
                        {SERVICE_PRIORITY_LABELS[order.priority]}
                      </Badge>
                    </div>
                  }
                  footer={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{order.property_name}</span>
                      </span>
                      <span>{formatDate(order.created_at)}</span>
                    </span>
                  }
                />
              </Link>
            ))}
          </div>
        )}
      </PageSection>
    </div>
  );
}
