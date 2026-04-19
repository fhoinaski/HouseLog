'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { providerApi, type ProviderServiceOrder } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn, SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatDate } from '@/lib/utils';
import { Wrench, ChevronRight, AlertTriangle, MapPin } from 'lucide-react';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested', approved: 'approved', in_progress: 'in_progress',
  completed: 'completed', verified: 'verified',
};
const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent', normal: 'normal', preventive: 'preventive',
};

export default function ProviderServicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useSWR(
    ['provider-services', statusFilter],
    () => providerApi.services(statusFilter ? { status: statusFilter } : undefined)
  );

  const orders = data?.data ?? [];

  return (
    <div className="safe-bottom space-y-5">
      <div>
        <h1 className="text-2xl font-medium">Minhas ordens de serviço</h1>
        <p className="text-sm text-muted-foreground">OS atribuídas a você</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['', 'approved', 'in_progress', 'completed', 'verified'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            data-active={statusFilter === s}
            className="hl-chip"
          >
            {s ? SERVICE_STATUS_LABELS[s] : 'Todas'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="hl-skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="mb-3 h-10 w-10 text-text-disabled" />
          <p className="text-sm text-muted-foreground">Nenhuma OS encontrada</p>
        </div>
      ) : (
        <div className="tap-highlight-none space-y-3">
          {orders.map((order: ProviderServiceOrder) => (
            <Link key={order.id} href={`/provider/services/${order.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-bg-subtle active:scale-[0.98]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        order.priority === 'urgent' ? 'bg-bg-danger' : 'bg-bg-accent-subtle'
                      )}>
                        <Wrench className={cn('h-4 w-4', order.priority === 'urgent' ? 'text-text-danger' : 'text-text-accent')} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{order.title}</p>
                          {order.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-text-danger" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{order.property_name} · {SYSTEM_TYPE_LABELS[order.system_type]}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={STATUS_VARIANT[order.status]} className="text-xs">
                            {SERVICE_STATUS_LABELS[order.status]}
                          </Badge>
                          <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
                            {SERVICE_PRIORITY_LABELS[order.priority]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                      <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
