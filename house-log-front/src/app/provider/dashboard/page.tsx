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
    { label: 'Em andamento', value: (stats.in_progress ?? 0) + (stats.approved ?? 0), icon: Wrench, color: 'text-text-warning', bg: 'bg-bg-warning' },
    { label: 'Concluídas', value: (stats.completed ?? 0) + (stats.verified ?? 0), icon: CheckCircle2, color: 'text-text-success', bg: 'bg-bg-success' },
    { label: 'Urgentes', value: 0, icon: AlertTriangle, color: 'text-text-danger', bg: 'bg-bg-danger' },
    { label: 'Total OS', value: total, icon: Clock, color: 'text-text-accent', bg: 'bg-bg-accent-subtle' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium text-text-primary">Olá, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-text-secondary">Bem-vindo ao seu portal de prestador</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xl font-medium text-text-primary">{s.value}</p>
                  <p className="text-xs text-text-secondary">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recentBids.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos orçamentos enviados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(recentBids as unknown as { id: string; service_title: string; property_name: string; amount: number; status: string; created_at: string }[]).map((bid) => (
              <div key={bid.id} className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{bid.service_title}</p>
                  <p className="text-xs text-muted-foreground">{bid.property_name} · {formatDate(bid.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text-success">{formatCurrency(bid.amount)}</span>
                  <Badge variant={bid.status === 'accepted' ? 'success' : bid.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                    {bid.status === 'accepted' ? 'Aceito' : bid.status === 'rejected' ? 'Recusado' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <Link href="/provider/services" className="flex items-center justify-between transition-opacity hover:opacity-80">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-accent-subtle">
                <Wrench className="h-4 w-4 text-text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium">Ver todas as OS</p>
                <p className="text-xs text-muted-foreground">Gerencie suas ordens de serviço</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
