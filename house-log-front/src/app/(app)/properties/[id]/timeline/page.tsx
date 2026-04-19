'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ImageIcon, Loader2, GitCommitVertical, X } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { type ServiceOrder } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, SYSTEM_TYPE_LABELS, formatDate, formatCurrency } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SYSTEM_COLORS: Record<string, string> = {
  electrical:     'bg-(--color-warning-light) text-(--color-warning)',
  plumbing:       'bg-(--color-info-light) text-(--color-info)',
  structural:     'bg-(--color-neutral-100) text-(--color-neutral-700)',
  waterproofing:  'bg-(--color-primary-light) text-(--color-primary)',
  painting:       'bg-(--color-info-light) text-(--color-info)',
  flooring:       'bg-(--color-warning-light) text-(--color-warning)',
  roofing:        'bg-(--color-danger-light) text-(--color-danger)',
  general:        'bg-(--color-neutral-100) text-(--color-neutral-600)',
};

const SYSTEM_DOT: Record<string, string> = {
  electrical: 'bg-(--color-warning)',
  plumbing:   'bg-(--color-info)',
  structural: 'bg-neutral-500',
  waterproofing: 'bg-(--color-primary)',
  painting:   'bg-(--color-info)',
  flooring:   'bg-(--color-warning)',
  roofing:    'bg-(--color-danger)',
  general:    'bg-neutral-500',
};

function parsePhotos(raw: string | undefined): string[] {
  try { return JSON.parse(raw ?? '[]') as string[]; } catch { return []; }
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="relative space-y-8 pl-8">
      <div className="absolute bottom-0 left-3 top-0 w-0.5 bg-(--hl-border-light)" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-(--hl-border-light)" />
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-(--hl-border-light)" />
          <div className="space-y-3 rounded-xl border border-(--hl-border-subtle) p-4 animate-pulse">
            <div className="h-4 w-48 rounded bg-(--hl-border-light)" />
            <div className="h-3 w-20 rounded bg-(--hl-border-subtle)" />
            <div className="flex gap-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-16 w-16 rounded-lg bg-(--hl-border-light)" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Timeline card ─────────────────────────────────────────────────────────────

function TimelineCard({
  order,
  onPhotoClick,
}: {
  order: ServiceOrder;
  onPhotoClick: (url: string) => void;
}) {
  const beforePhotos = parsePhotos(order.before_photos);
  const afterPhotos  = parsePhotos(order.after_photos);
  const dotColor = SYSTEM_DOT[order.system_type] ?? 'bg-primary-500';
  const badgeColor = SYSTEM_COLORS[order.system_type] ?? 'bg-neutral-100 text-neutral-600';
  const completedDate = order.completed_at ?? order.created_at;

  return (
    <div className="relative">
      <div className={cn('absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white', dotColor)} />
      <p className="mb-1.5 text-xs text-(--hl-text-tertiary)">{formatDate(completedDate)}</p>

      <Card className="transition-colors hover:bg-(--color-neutral-50) active:scale-[0.98]">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm leading-snug">{order.title}</p>
              {order.assigned_to_name && (
                <p className="mt-0.5 text-xs text-(--hl-text-tertiary)">{order.assigned_to_name}</p>
              )}
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', badgeColor)}>
              {SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type}
            </span>
          </div>

          {/* Description */}
          {order.description && (
            <p className="line-clamp-2 text-xs text-(--hl-text-secondary)">{order.description}</p>
          )}

          {/* Photos */}
          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <div className="space-y-1.5">
              {beforePhotos.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-(--hl-text-tertiary)">Antes</p>
                  <div className="flex gap-2 flex-wrap">
                    {beforePhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`antes-${i + 1}`}
                          className="h-16 w-16 rounded-lg border border-(--hl-border-light) object-cover transition-opacity group-hover:opacity-80"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="h-5 w-5 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {afterPhotos.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-(--hl-text-tertiary)">Depois</p>
                  <div className="flex gap-2 flex-wrap">
                    {afterPhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`depois-${i + 1}`}
                          className="h-16 w-16 rounded-lg border border-(--hl-border-light) object-cover transition-opacity group-hover:opacity-80"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="h-5 w-5 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {order.cost != null && (
            <p className="text-xs font-medium text-(--hl-text-secondary)">
              Custo: <span className="text-(--hl-text-primary)">{formatCurrency(order.cost)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filters, setFilters] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data, isLoading, isLoadingMore, hasMore, loadMore } =
    usePagination<ServiceOrder>(`/properties/${id}/services`, { status: 'completed' });

  // Sort by completed_at desc (API doesn't support sort param yet)
  const sorted = [...data].sort((a, b) => {
    const dA = a.completed_at ?? a.created_at;
    const dB = b.completed_at ?? b.created_at;
    return dB.localeCompare(dA);
  });

  const filtered = filters.length > 0
    ? sorted.filter((o) => filters.includes(o.system_type))
    : sorted;

  const systemTypes = [...new Set(data.map((o) => o.system_type))].sort();

  function toggleFilter(type: string) {
    setFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="max-w-2xl space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/properties/${id}/services`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-medium">Timeline de manutenção</h2>
          <p className="text-xs text-(--hl-text-tertiary)">Histórico de OS concluídas</p>
        </div>
      </div>

      {/* System-type filters */}
      {systemTypes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {systemTypes.map((type) => {
            const active = filters.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  active
                    ? cn(SYSTEM_COLORS[type] ?? 'bg-primary-600 text-white', 'border-transparent')
                    : 'border-(--hl-border-light) bg-white text-(--hl-text-secondary) hover:border-(--hl-border-strong)'
                )}
              >
                {SYSTEM_TYPE_LABELS[type] ?? type}
              </button>
            );
          })}
          {filters.length > 0 && (
            <button
              onClick={() => setFilters([])}
              className="rounded-full border border-(--hl-border-light) px-3 py-1 text-xs font-medium text-(--hl-text-tertiary) transition-colors hover:text-(--hl-text-secondary)"
            >
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
          <CheckCircle2 className="mb-3 h-10 w-10 text-(--hl-text-tertiary)" />
          <p className="text-sm text-(--hl-text-tertiary)">
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
        <div className="relative pl-8 space-y-7">
          <div className="absolute bottom-0 left-3 top-0 w-0.5 bg-(--hl-border-light)" />
          {filtered.map((order) => (
            <TimelineCard
              key={order.id}
              order={order}
              onPhotoClick={setLightbox}
            />
          ))}

          {hasMore && (
            <div className="relative flex justify-center pt-2">
              <div className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-(--hl-border-light)">
                <GitCommitVertical className="-ml-px -mt-px h-3 w-3 text-(--hl-text-tertiary)" />
              </div>
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
