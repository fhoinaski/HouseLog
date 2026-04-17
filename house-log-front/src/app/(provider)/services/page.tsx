'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { providerApi, type ProviderServiceOrder } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn, SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatDate } from '@/lib/utils';
import { Wrench, ChevronRight, AlertTriangle, Clock, CheckCircle2, MapPin } from 'lucide-react';

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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Minhas Ordens de Serviço</h1>
        <p className="text-sm text-[var(--muted-foreground)]">OS atribuídas a você</p>
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
                : 'bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-primary-400'
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
            <div key={i} className="h-24 rounded-xl bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-[var(--muted-foreground)] text-sm">Nenhuma OS encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: ProviderServiceOrder) => (
            <Link key={order.id} href={`/provider/services/${order.id}`}>
              <Card className="cursor-pointer hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn(
                        'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                        order.priority === 'urgent' ? 'bg-rose-50' : 'bg-primary-50'
                      )}>
                        <Wrench className={cn('h-4 w-4', order.priority === 'urgent' ? 'text-rose-500' : 'text-primary-600')} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{order.title}</p>
                          {order.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--muted-foreground)]">
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
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[var(--muted-foreground)]">{formatDate(order.created_at)}</p>
                      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] ml-auto mt-1" />
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
