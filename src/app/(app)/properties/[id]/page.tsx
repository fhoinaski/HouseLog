'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Building2, MapPin, Ruler, Calendar, Activity,
  Wrench, Package, FileText, BarChart3, AlertTriangle,
  CheckCircle2, Clock,
} from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, scoreColor, scoreBg, PROPERTY_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

function StatCard({
  title, value, sub, icon: Icon, color = 'text-primary-600', alert,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{title}</p>
            <p className={cn('text-2xl font-bold mt-1', alert ? 'text-rose-500' : color)}>{value}</p>
            {sub && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
          </div>
          <div className={cn('rounded-lg p-2', alert ? 'bg-rose-50' : 'bg-primary-50')}>
            <Icon className={cn('h-5 w-5', alert ? 'text-rose-500' : color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-sm font-bold w-8 text-right', scoreColor(score))}>{score}</span>
    </div>
  );
}

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

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
        <div className="h-8 w-64 bg-[var(--muted)] rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-[var(--muted)] rounded-[var(--radius-lg)]" />)}
        </div>
      </div>
    );
  }

  const property = propData?.property;
  if (!property) return <div className="text-center py-20 text-[var(--muted-foreground)]">Imóvel não encontrado</div>;

  const d = dash;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{property.name}</h1>
          <div className="flex items-center gap-1 mt-1 text-sm text-[var(--muted-foreground)]">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}, {property.city}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/properties/${id}/services/new`}>
              <Wrench className="h-4 w-4" />
              Nova OS
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/properties/${id}/inventory`}>
              <Package className="h-4 w-4" />
              Inventário
            </Link>
          </Button>
        </div>
      </div>

      {/* Health score */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-semibold">Score de Saúde</span>
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
            color="text-emerald-600"
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

      {/* Property details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0">
            <dl className="space-y-3">
              {property.area_m2 && (
                <div className="flex justify-between text-sm">
                  <dt className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Ruler className="h-3.5 w-3.5" /> Área
                  </dt>
                  <dd className="font-medium">{property.area_m2} m²</dd>
                </div>
              )}
              {property.year_built && (
                <div className="flex justify-between text-sm">
                  <dt className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Calendar className="h-3.5 w-3.5" /> Construído em
                  </dt>
                  <dd className="font-medium">{property.year_built}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <Building2 className="h-3.5 w-3.5" /> Andares
                </dt>
                <dd className="font-medium">{property.floors}</dd>
              </div>
              {property.structure && (
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--muted-foreground)]">Estrutura</dt>
                  <dd className="font-medium">{property.structure}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="flex items-center gap-2 text-[var(--muted-foreground)]">
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
                { href: `/properties/${id}/inventory`, icon: Package, label: 'Inventário', color: 'bg-amber-50 text-amber-600' },
                { href: `/properties/${id}/services`, icon: Wrench, label: 'Serviços', color: 'bg-primary-50 text-primary-600' },
                { href: `/properties/${id}/documents`, icon: FileText, label: 'Documentos', color: 'bg-violet-50 text-violet-600' },
                { href: `/properties/${id}/financial`, icon: BarChart3, label: 'Financeiro', color: 'bg-emerald-50 text-emerald-600' },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-4 hover:bg-[var(--muted)] transition-colors"
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
    </div>
  );
}
