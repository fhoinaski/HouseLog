'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Briefcase, ChevronRight, MapPin } from 'lucide-react';
import { providerApi, type ProviderOpportunity } from '@/lib/api';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

export default function ProviderOpportunitiesPage() {
  const [systemFilter, setSystemFilter] = useState('');

  const { data, isLoading } = useSWR(
    ['provider-opportunities', systemFilter],
    () => providerApi.opportunities(systemFilter ? { system_type: systemFilter } : undefined)
  );

  const opportunities = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Oportunidades de Orçamento</h1>
        <p className="text-sm text-muted-foreground">OS abertas para envio de proposta</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'electrical', 'plumbing', 'structural', 'waterproofing', 'painting', 'flooring', 'roofing', 'general'].map((s) => (
          <Button
            key={s || 'all'}
            type="button"
            size="sm"
            variant={systemFilter === s ? 'default' : 'outline'}
            onClick={() => setSystemFilter(s)}
          >
            {s ? SYSTEM_TYPE_LABELS[s] : 'Todos os sistemas'}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="py-20 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma oportunidade disponível no momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((item: ProviderOpportunity) => (
            <Link key={item.id} href={`/provider/opportunities/${item.id}`}>
              <Card className="cursor-pointer hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {SYSTEM_TYPE_LABELS[item.system_type]} · {item.room_name ?? 'Sem cômodo'}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {item.property_name}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={PRIORITY_VARIANT[item.priority]} className="text-xs">
                          {SERVICE_PRIORITY_LABELS[item.priority]}
                        </Badge>
                        {item.my_bid ? (
                          <Badge variant={item.my_bid.status === 'accepted' ? 'success' : item.my_bid.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                            Meu orçamento: {formatCurrency(item.my_bid.amount)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Sem proposta enviada</Badge>
                        )}
                      </div>
                    </div>
                    <div className={cn('text-right shrink-0', item.my_bid ? 'text-foreground' : 'text-muted-foreground')}>
                      <p className="text-xs">{formatDate(item.created_at)}</p>
                      <ChevronRight className="h-4 w-4 ml-auto mt-1" />
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
