'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Building2, MapPin, Sparkles } from 'lucide-react';
import { SetupWizard } from '@/components/onboarding/setup-wizard';
import { type Property } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, scoreColor, PROPERTY_TYPE_LABELS } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

function HealthScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={score < 30 ? '#f43f5e' : score < 60 ? '#f59e0b' : score < 80 ? '#10b981' : '#3b82f6'}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('absolute text-sm font-bold', scoreColor(score))}>{score}</span>
    </div>
  );
}

const COVER_GRADIENTS: Record<string, string> = {
  house:       'from-blue-900 via-indigo-900 to-slate-900',
  apt:         'from-violet-900 via-purple-900 to-slate-900',
  commercial:  'from-amber-900 via-orange-900 to-slate-900',
  warehouse:   'from-slate-800 via-zinc-800 to-zinc-900',
};

function PropertyCard({ property }: { property: Property }) {
  const typeLabel = PROPERTY_TYPE_LABELS[property.type] ?? property.type;
  const gradient = COVER_GRADIENTS[property.type] ?? 'from-slate-800 to-zinc-900';

  return (
    <Link href={`/properties/${property.id}`}>
      <Card className="overflow-hidden cursor-pointer group card-hover border-[var(--border)] hover:border-primary-500/30">
        {/* Cover */}
        <div className={`relative h-44 bg-gradient-to-br ${gradient} overflow-hidden`}>
          {property.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.cover_url}
              alt={property.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Building2 className="h-14 w-14 text-white/10" />
            </div>
          )}
          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
              {typeLabel}
            </span>
          </div>
          <div className="absolute top-2 right-2">
            <HealthScoreRing score={property.health_score} />
          </div>

          {/* Property name overlay on cover */}
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="font-bold text-sm text-white truncate drop-shadow">{property.name}</h3>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] min-w-0">
              <MapPin className="h-3 w-3 flex-shrink-0 text-primary-400" />
              <span className="truncate">{property.city}</span>
            </div>
            {property.area_m2 && (
              <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{property.area_m2} m²</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: properties, isLoading, isLoadingMore, hasMore, loadMore } =
    usePagination<Property>('/properties', search ? { search } : undefined);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-500 mb-1">
            Portfólio
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {properties.length > 0
              ? `Você tem ${properties.length} imóvel${properties.length !== 1 ? 'is' : ''} cadastrado${properties.length !== 1 ? 's' : ''}.`
              : 'Comece adicionando seu primeiro imóvel.'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setWizardOpen(true)}>
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Configuração guiada</span>
          </Button>
          <Button onClick={() => router.push('/properties/new')}>
            <Plus className="h-4 w-4" />
            Novo Imóvel
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          placeholder="Buscar por nome ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-[var(--radius-xl)] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
              <div className="h-44 bg-[var(--muted)] animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-3/4 bg-[var(--muted)] rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-[var(--muted)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--muted)] mb-5">
            <Building2 className="h-10 w-10 text-[var(--muted-foreground)]" />
          </div>
          <h2 className="text-lg font-semibold">
            {search ? 'Nenhum imóvel encontrado' : 'Nenhum imóvel cadastrado'}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {!search && 'Adicione seu primeiro imóvel para começar.'}
          </p>
          {!search && (
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setWizardOpen(true)}>
                <Sparkles className="h-4 w-4" />
                Configuração guiada
              </Button>
              <Button variant="outline" onClick={() => router.push('/properties/new')}>
                <Plus className="h-4 w-4" />
                Adicionar Imóvel
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Carregar mais'
                )}
              </Button>
            </div>
          )}
        </>
      )}

      <SetupWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
