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

function PropertyCard({ property }: { property: Property }) {
  const typeLabel = PROPERTY_TYPE_LABELS[property.type] ?? property.type;

  return (
    <Link href={`/properties/${property.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
        {/* Cover */}
        <div className="relative h-40 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
          {property.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.cover_url}
              alt={property.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Building2 className="h-12 w-12 text-slate-400" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
          </div>
          <div className="absolute top-3 right-3">
            <HealthScoreRing score={property.health_score} />
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-sm truncate">{property.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-[var(--muted-foreground)]">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{property.city}</span>
          </div>
          {property.area_m2 && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{property.area_m2} m²</p>
          )}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seus Imóveis</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Olá, {user?.name?.split(' ')[0]}. Gerencie seu portfólio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWizardOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Configuração guiada
          </Button>
          <Button onClick={() => router.push('/properties/new')}>
            <Plus className="h-4 w-4" />
            Novo Imóvel
          </Button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por nome ou cidade..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-primary-500"
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 rounded-[var(--radius-lg)] bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-12 w-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-[var(--muted-foreground)]">
            {search ? 'Nenhum imóvel encontrado' : 'Nenhum imóvel cadastrado'}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {!search && 'Adicione seu primeiro imóvel para começar.'}
          </p>
          {!search && (
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
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
