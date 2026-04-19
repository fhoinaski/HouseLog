'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, MapPin, Ruler, Calendar, Activity,
  Wrench, Package, FileText, BarChart3,
  CheckCircle2, Clock, Home, RefreshCw, Pencil, GitBranch, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, scoreColor, scoreBg, PROPERTY_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

function StatCard({
  title, value, sub, icon: Icon, color = 'text-(--color-primary)', alert,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-(--hl-text-tertiary)">{title}</p>
            <p className={cn('mt-1 text-2xl font-medium', alert ? 'text-(--color-danger)' : color)}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn('rounded-lg p-2', alert ? 'bg-(--color-danger-light)' : 'bg-(--color-primary-light)')}>
            <Icon className={cn('h-5 w-5', alert ? 'text-(--color-danger)' : color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('w-8 text-right text-sm font-medium', scoreColor(score))}>{score}</span>
    </div>
  );
}

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: propData, isLoading: propLoading } = useSWR(
    ['property', id],
    () => propertiesApi.get(id)
  );

  const { data: dash, isLoading: dashLoading } = useSWR(
    ['dashboard', id],
    () => propertiesApi.dashboard(id)
  );

  if (propLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-lg bg-muted" />)}
        </div>
      </div>
    );
  }

  const property = propData?.property;
  if (!property) return <div className="py-20 text-center text-muted-foreground">Imóvel não encontrado</div>;

  const d = dash;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
          </div>
          <h1 className="text-2xl font-medium">{property.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}, {property.city}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Wrench className="h-4 w-4" />
            Nova OS
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/properties/${id}/edit`}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Health score */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-(--color-primary)" />
              <span className="text-sm font-medium">Score de saude</span>
            </div>
            <span className={cn('text-xs font-medium', scoreColor(d?.health_score ?? property.health_score))}>
              {(d?.health_score ?? property.health_score) >= 80 ? 'Excelente' :
               (d?.health_score ?? property.health_score) >= 60 ? 'Bom' :
               (d?.health_score ?? property.health_score) >= 30 ? 'Atenção' : 'Crítico'}
            </span>
          </div>
          <ScoreBar score={d?.health_score ?? property.health_score} />
        </CardContent>
      </Card>

      {/* Stats */}
      {!dashLoading && d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Despesa Mensal"
            value={formatCurrency(d.expenses.this_month ?? 0)}
            sub="mês atual"
            icon={BarChart3}
          />
          <StatCard
            title="OS Abertas"
            value={d.services.requested + d.services.in_progress}
            sub={`${d.services.urgent_open} urgentes`}
            icon={Wrench}
            alert={d.services.urgent_open > 0}
          />
          <StatCard
            title="OS Concluídas"
            value={d.services.done}
            sub="total"
            icon={CheckCircle2}
            color="text-(--color-success)"
          />
          <StatCard
            title="Itens Inventário"
            value={d.inventory.total}
            sub={d.inventory.low_stock > 0 ? `${d.inventory.low_stock} em falta` : 'tudo ok'}
            icon={Package}
            alert={d.inventory.low_stock > 0}
          />
        </div>
      )}

      {/* Warranties expiring card */}
      {d?.warranties_expiring && d.warranties_expiring.length > 0 && (
        <Card className="border-(--color-warning-border) bg-(--color-warning-light)">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-(--color-warning)" />
              Garantias a vencer (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="space-y-2">
              {d.warranties_expiring.map((w) => (
                <Link
                  key={w.id}
                  href={`/properties/${id}/inventory`}
                  className="flex items-center justify-between rounded-lg border border-(--color-warning-border) bg-white px-3 py-2 transition-colors hover:bg-(--color-warning-light) active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className={cn(
                      'h-4 w-4 shrink-0',
                      w.days_left <= 7 ? 'text-(--color-danger)' : 'text-(--color-warning)'
                    )} />
                    <span className="text-sm font-medium truncate">{w.name}</span>
                  </div>
                  <span className={cn(
                    'ml-3 shrink-0 text-xs font-medium',
                    w.days_left <= 7 ? 'text-(--color-danger)' : 'text-(--color-warning)'
                  )}>
                    {w.days_left === 0 ? 'Vence hoje' : `${w.days_left}d`}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0">
            <dl className="space-y-3">
              {property.area_m2 && (
                <div className="flex justify-between text-sm">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Ruler className="h-3.5 w-3.5" /> Área
                  </dt>
                  <dd className="font-medium">{property.area_m2} m²</dd>
                </div>
              )}
              {property.year_built && (
                <div className="flex justify-between text-sm">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> Construído em
                  </dt>
                  <dd className="font-medium">{property.year_built}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> Andares
                </dt>
                <dd className="font-medium">{property.floors}</dd>
              </div>
              {property.structure && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Estrutura</dt>
                  <dd className="font-medium">{property.structure}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Cadastrado
                </dt>
                <dd className="font-medium">{formatDate(property.created_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Acesso Rápido</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: `/properties/${id}/rooms`, icon: Home, label: 'Cômodos', color: 'bg-(--color-neutral-50) text-(--color-neutral-700)' },
                { href: `/properties/${id}/inventory`, icon: Package, label: 'Inventário', color: 'bg-(--color-warning-light) text-(--color-warning)' },
                { href: `/properties/${id}/services`, icon: Wrench, label: 'Serviços', color: 'bg-(--color-primary-light) text-(--color-primary)' },
                { href: `/properties/${id}/timeline`, icon: GitBranch, label: 'Timeline', color: 'bg-(--color-neutral-100) text-(--color-neutral-700)' },
                { href: `/properties/${id}/maintenance`, icon: RefreshCw, label: 'Manutenção', color: 'bg-(--color-warning-light) text-(--color-warning)' },
                { href: `/properties/${id}/documents`, icon: FileText, label: 'Documentos', color: 'bg-(--color-neutral-100) text-(--color-neutral-700)' },
                { href: `/properties/${id}/financial`, icon: BarChart3, label: 'Financeiro', color: 'bg-(--color-success-light) text-(--color-success)' },
                { href: `/properties/${id}/report`, icon: Activity, label: 'Relatório', color: 'bg-(--color-primary-light) text-(--color-primary)' },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <div className={cn('rounded-lg p-2', color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ServiceOrderCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        propertyId={id}
        onCreated={(orderId) => router.push(`/properties/${id}/services/${orderId}`)}
      />
    </div>
  );
}
