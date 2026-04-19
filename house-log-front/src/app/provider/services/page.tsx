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
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-medium">Minhas ordens de serviço</h1>
        <p className="text-sm text-muted-foreground">OS atribuídas a você</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'approved', 'in_progress', 'completed', 'verified'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
              statusFilter === s
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-border bg-card text-muted-foreground hover:border-primary-400'
            )}
          >
            {s ? SERVICE_STATUS_LABELS[s] : 'Todas'}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-muted-foreground text-sm">Nenhuma OS encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: ProviderServiceOrder) => (
            <Link key={order.id} href={`/provider/services/${order.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-(--color-neutral-50) active:scale-[0.98]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        order.priority === 'urgent' ? 'bg-(--color-danger-light)' : 'bg-(--color-primary-light)'
                      )}>
                        <Wrench className={cn('h-4 w-4', order.priority === 'urgent' ? 'text-(--color-danger)' : 'text-(--color-primary)')} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{order.title}</p>
                          {order.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 text-(--color-danger) shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{order.property_name} · {SYSTEM_TYPE_LABELS[order.system_type]}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant={STATUS_VARIANT[order.status]} className="text-xs">
                            {SERVICE_STATUS_LABELS[order.status]}
                          </Badge>
                          <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
                            {SERVICE_PRIORITY_LABELS[order.priority]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
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
