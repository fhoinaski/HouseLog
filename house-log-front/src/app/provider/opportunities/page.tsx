'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Briefcase, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderCard } from '@/components/services/service-order-card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { providerApi, type ProviderNetworkOpportunity } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

const SYSTEM_FILTERS = [
  '',
  'electrical',
  'plumbing',
  'structural',
  'waterproofing',
  'painting',
  'flooring',
  'roofing',
  'general',
];

export default function ProviderOpportunitiesPage() {
  const [systemFilter, setSystemFilter] = useState('');

  const { data, isLoading } = useSWR(['provider-opportunities', systemFilter], () =>
    providerApi.opportunities(systemFilter ? { system_type: systemFilter } : undefined)
  );

  const opportunities = data?.data ?? [];

  return (
    <div className="safe-bottom space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Provider network"
        title="Rede homologada"
        description="Solicitações elegíveis para sua atuação técnica dentro da operação privada HouseLog."
      />

      <PageSection
        title="Elegibilidade técnica"
        description="Filtre por sistema para priorizar os chamados mais aderentes ao seu perfil homologado."
        contentClassName="flex flex-wrap gap-2"
      >
        {SYSTEM_FILTERS.map((system) => (
          <Button
            key={system || 'all'}
            type="button"
            size="sm"
            variant={systemFilter === system ? 'default' : 'outline'}
            onClick={() => setSystemFilter(system)}
          >
            {system ? SYSTEM_TYPE_LABELS[system] : 'Todos os sistemas'}
          </Button>
        ))}
      </PageSection>

      <PageSection
        title="Operações elegíveis"
        description="Solicitações abertas para análise e proposta dentro da rede homologada."
        tone="strong"
      >
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Nenhuma solicitação elegível no momento"
            description="Quando uma operação privada compatível com sua homologação estiver disponível, ela aparecerá aqui para análise."
            tone="subtle"
            density="spacious"
          />
        ) : (
          <div className="space-y-3">
            {opportunities.map((item: ProviderNetworkOpportunity) => (
              <Link key={item.id} href={`/provider/opportunities/${item.id}`} className="block">
                <ServiceOrderCard
                  interactive
                  leadingIcon={<Briefcase className="h-4 w-4" />}
                  title={item.title}
                  meta={`${SYSTEM_TYPE_LABELS[item.system_type]} - ${item.room_name ?? 'Sem cômodo'}`}
                  value={item.my_bid ? formatCurrency(item.my_bid.amount) : undefined}
                  status={
                    <div className="flex max-w-[10rem] flex-wrap justify-end gap-1.5">
                      <Badge variant={PRIORITY_VARIANT[item.priority]} className="text-xs">
                        {SERVICE_PRIORITY_LABELS[item.priority]}
                      </Badge>
                      {item.my_bid ? (
                        <Badge
                          variant={
                            item.my_bid.status === 'accepted'
                              ? 'success'
                              : item.my_bid.status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          Proposta enviada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Elegível
                        </Badge>
                      )}
                    </div>
                  }
                  footer={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.property_name}</span>
                      </span>
                      <span>{formatDate(item.created_at)}</span>
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
