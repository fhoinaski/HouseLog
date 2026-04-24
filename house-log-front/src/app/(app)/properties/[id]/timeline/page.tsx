'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ImageIcon, Loader2, X } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { normalizeMediaUrl, type ServiceOrder } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, SYSTEM_TYPE_LABELS, formatDate, formatCurrency } from '@/lib/utils';

const SYSTEM_DOT_VAR: Record<string, string> = {
  electrical:    'var(--text-warning)',
  plumbing:      'var(--interactive-primary-bg)',
  structural:    'var(--text-secondary)',
  waterproofing: 'var(--interactive-primary-bg)',
  painting:      'var(--interactive-primary-bg)',
  flooring:      'var(--text-warning)',
  roofing:       'var(--text-danger)',
  general:       'var(--text-tertiary)',
};

const SYSTEM_BADGE: Record<string, string> = {
  electrical:    'bg-bg-warning text-text-warning',
  plumbing:      'bg-bg-info text-text-info',
  structural:    'bg-bg-subtle text-text-secondary',
  waterproofing: 'bg-bg-info text-text-info',
  painting:      'bg-bg-accent-subtle text-text-accent',
  flooring:      'bg-bg-warning text-text-warning',
  roofing:       'bg-bg-danger text-text-danger',
  general:       'bg-bg-subtle text-text-secondary',
};

function parsePhotos(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string').map(normalizeMediaUrl);
  }
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').map(normalizeMediaUrl)
      : [];
  } catch {
    return [];
  }
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Foto ampliada"
        className="max-h-[90vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-10">
      {[...Array(2)].map((_, gi) => (
        <div key={gi}>
          <div className="hl-skeleton mb-4 h-6 w-32 rounded" />
          <div className="relative space-y-6 pl-8">
            <div className="absolute bottom-0 left-3 top-0 w-px bg-border-subtle" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[1.15rem] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg-page)] bg-border-subtle" />
                <div className="hl-skeleton mb-2 h-3 w-24 rounded" />
                <div className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineCard({
  order,
  onPhotoClick,
}: {
  order: ServiceOrder;
  onPhotoClick: (url: string) => void;
}) {
  const beforePhotos = parsePhotos(order.before_photos);
  const afterPhotos  = parsePhotos(order.after_photos);
  const dotColor = SYSTEM_DOT_VAR[order.system_type] ?? 'var(--text-tertiary)';
  const badgeClass = SYSTEM_BADGE[order.system_type] ?? 'bg-bg-subtle text-text-secondary';
  const completedDate = order.completed_at ?? order.created_at;

  return (
    <div className="relative">
      <div
        className="absolute -left-[1.15rem] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg-page)]"
        style={{ background: dotColor }}
      />
      <p className="mb-1.5 text-xs text-text-tertiary">{formatDate(completedDate)}</p>

      <Card className="transition-colors hover:bg-bg-subtle active:scale-[0.99]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-text-primary">{order.title}</p>
              {order.assigned_to_name && (
                <p className="mt-0.5 text-xs text-text-tertiary">{order.assigned_to_name}</p>
              )}
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', badgeClass)}>
              {SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type}
            </span>
          </div>

          {order.description && (
            <p className="line-clamp-2 text-xs text-text-secondary">{order.description}</p>
          )}

          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <div className="space-y-2">
              {beforePhotos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-text-tertiary">Antes</p>
                  <div className="flex flex-wrap gap-2">
                    {beforePhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`antes-${i + 1}`}
                          className="h-16 w-16 rounded-[var(--radius-md)] border border-border-subtle object-cover transition-opacity group-hover:opacity-75"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <ImageIcon className="h-5 w-5 text-white drop-shadow" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {afterPhotos.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-text-tertiary">Depois</p>
                  <div className="flex flex-wrap gap-2">
                    {afterPhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`depois-${i + 1}`}
                          className="h-16 w-16 rounded-[var(--radius-md)] border border-border-subtle object-cover transition-opacity group-hover:opacity-75"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <ImageIcon className="h-5 w-5 text-white drop-shadow" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {order.cost != null && (
            <p className="text-xs text-text-tertiary">
              Custo: <span className="font-medium text-text-secondary">{formatCurrency(order.cost)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
}

export default function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filters, setFilters] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data, isLoading, isLoadingMore, hasMore, loadMore } =
    usePagination<ServiceOrder>(`/properties/${id}/services`, { status: 'completed' });

  const sorted = [...data].sort((a, b) => {
    const dA = a.completed_at ?? a.created_at;
    const dB = b.completed_at ?? b.created_at;
    return dB.localeCompare(dA);
  });

  const filtered = filters.length > 0
    ? sorted.filter((o) => filters.includes(o.system_type))
    : sorted;

  const systemTypes = [...new Set(data.map((o) => o.system_type))].sort();

  // Group by month
  const groups: { label: string; items: ServiceOrder[] }[] = [];
  for (const order of filtered) {
    const dateStr = order.completed_at ?? order.created_at;
    const label = getMonthKey(dateStr);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(order);
    } else {
      groups.push({ label, items: [order] });
    }
  }

  function toggleFilter(type: string) {
    setFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="max-w-2xl space-y-6 safe-bottom">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0">
          <Link href={`/properties/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-light tracking-tight text-text-primary">
            Linha do tempo
          </h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Memória técnica viva · OS concluídas
          </p>
        </div>
      </div>

      {/* Filters */}
      {systemTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {systemTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className="hl-chip"
              data-active={filters.includes(type) ? 'true' : undefined}
            >
              {SYSTEM_TYPE_LABELS[type] ?? type}
            </button>
          ))}
          {filters.length > 0 && (
            <button onClick={() => setFilters([])} className="hl-chip">
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm text-text-tertiary">
            {filters.length > 0
              ? 'Nenhuma OS concluída para o filtro selecionado'
              : 'Nenhuma OS concluída ainda'}
          </p>
          {filters.length > 0 && (
            <Button variant="outline" className="mt-3" onClick={() => setFilters([])}>
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Month/year editorial header */}
              <div className="mb-4 flex items-baseline gap-3">
                <span className="text-lg font-light capitalize text-text-primary">
                  {group.label}
                </span>
                <span className="text-xs text-text-tertiary">{group.items.length} evento{group.items.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Rail */}
              <div className="relative space-y-6 pl-8">
                <div className="absolute bottom-0 left-3 top-0 w-px bg-border-subtle" />
                {group.items.map((order) => (
                  <TimelineCard
                    key={order.id}
                    order={order}
                    onPhotoClick={setLightbox}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
              </Button>
            </div>
          )}
        </div>
      )}

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
