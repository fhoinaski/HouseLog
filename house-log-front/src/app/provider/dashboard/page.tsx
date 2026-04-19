'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { providerApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, CheckCircle2, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { data } = useSWR('provider-stats', providerApi.stats);

  const stats = data?.stats ?? {};
  const total = data?.total ?? 0;
  const recentBids = data?.recent_bids ?? [];

  const statCards = [
    { label: 'Em andamento', value: (stats.in_progress ?? 0) + (stats.approved ?? 0), icon: Wrench, color: 'text-(--color-warning)', bg: 'bg-(--color-warning-light)' },
    { label: 'Concluídas', value: (stats.completed ?? 0) + (stats.verified ?? 0), icon: CheckCircle2, color: 'text-(--color-success)', bg: 'bg-(--color-success-light)' },
    { label: 'Urgentes', value: 0, icon: AlertTriangle, color: 'text-(--color-danger)', bg: 'bg-(--color-danger-light)' },
    { label: 'Total OS', value: total, icon: Clock, color: 'text-(--color-primary)', bg: 'bg-(--color-primary-light)' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-medium text-(--hl-text-primary)">Ola, {user?.name?.split(' ')[0]}</h1>
        <p className="text-[13px] text-(--hl-text-secondary)">Bem-vindo ao seu portal de prestador</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-[20px] font-medium text-(--hl-text-primary)">{s.value}</p>
                  <p className="text-[12px] text-(--hl-text-secondary)">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent bids */}
      {recentBids.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Orçamentos Enviados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(recentBids as unknown as { id: string; service_title: string; property_name: string; amount: number; status: string; created_at: string }[]).map((bid) => (
              <div key={bid.id} className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{bid.service_title}</p>
                  <p className="text-xs text-muted-foreground">{bid.property_name} · {formatDate(bid.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-(--color-success)">{formatCurrency(bid.amount)}</span>
                  <Badge variant={bid.status === 'accepted' ? 'success' : bid.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                    {bid.status === 'accepted' ? 'Aceito' : bid.status === 'rejected' ? 'Recusado' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick access */}
      <Card>
        <CardContent className="p-4">
          <Link href="/provider/services" className="flex items-center justify-between hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50">
                <Wrench className="h-4 w-4 text-(--color-primary)" />
              </div>
              <div>
                <p className="font-medium text-sm">Ver todas as OS</p>
                <p className="text-xs text-muted-foreground">Gerencie suas ordens de servico</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
