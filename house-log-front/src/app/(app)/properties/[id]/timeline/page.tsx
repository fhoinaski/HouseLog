'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ImageIcon, Loader2, GitCommitVertical, X } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { normalizeMediaUrl, type ServiceOrder } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, SYSTEM_TYPE_LABELS, formatDate, formatCurrency } from '@/lib/utils';

const SYSTEM_COLORS: Record<string, string> = {
  electrical:     'bg-bg-warning text-text-warning',
  plumbing:       'bg-bg-accent-subtle text-text-accent',
  structural:     'bg-bg-subtle text-text-secondary',
  waterproofing:  'bg-bg-accent-subtle text-text-accent',
  painting:       'bg-bg-accent-subtle text-text-accent',
  flooring:       'bg-bg-warning text-text-warning',
  roofing:        'bg-bg-danger text-text-danger',
  general:        'bg-bg-subtle text-text-secondary',
};

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

function parsePhotos(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeMediaUrl);
  }
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeMediaUrl)
      : [];
  } catch {
    return [];
  }
}

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

function TimelineSkeleton() {
  return (
    <div className="relative space-y-8 pl-8">
      <div className="absolute bottom-0 left-3 top-0 w-0.5 bg-border-subtle" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-border-subtle" />
          <div className="hl-skeleton mb-2 h-4 w-24 rounded" />
          <div className="hl-skeleton space-y-3 rounded-xl p-4">
            <div className="hl-skeleton h-4 w-48 rounded" />
            <div className="hl-skeleton h-3 w-20 rounded" />
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
  const dotVar = SYSTEM_DOT_VAR[order.system_type] ?? 'var(--text-tertiary)';
  const badgeColor = SYSTEM_COLORS[order.system_type] ?? 'bg-bg-subtle text-text-secondary';
  const completedDate = order.completed_at ?? order.created_at;

  return (
    <div className="relative">
      <div
        className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white"
        style={{ background: dotVar }}
      />
      <p className="mb-1.5 text-xs text-text-tertiary">{formatDate(completedDate)}</p>

      <Card className="transition-colors hover:bg-bg-subtle active:scale-[0.98]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm text-text-primary leading-snug">{order.title}</p>
              {order.assigned_to_name && (
                <p className="mt-0.5 text-xs text-text-tertiary">{order.assigned_to_name}</p>
              )}
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', badgeColor)}>
              {SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type}
            </span>
          </div>

          {order.description && (
            <p className="line-clamp-2 text-xs text-text-secondary">{order.description}</p>
          )}

          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <div className="space-y-1.5">
              {beforePhotos.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-text-tertiary">Antes</p>
                  <div className="flex gap-2 flex-wrap">
                    {beforePhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`antes-${i + 1}`}
                          className="h-16 w-16 rounded-lg border-half border-border-subtle object-cover transition-opacity group-hover:opacity-80"
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
                  <p className="mb-1 text-xs text-text-tertiary">Depois</p>
                  <div className="flex gap-2 flex-wrap">
                    {afterPhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`depois-${i + 1}`}
                          className="h-16 w-16 rounded-lg border-half border-border-subtle object-cover transition-opacity group-hover:opacity-80"
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

          {order.cost != null && (
            <p className="text-xs font-medium text-text-secondary">
              Custo: <span className="text-text-primary">{formatCurrency(order.cost)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
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

  function toggleFilter(type: string) {
    setFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="max-w-2xl space-y-5 safe-bottom">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/properties/${id}/services`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-medium text-text-primary">Timeline de manutenção</h2>
          <p className="text-xs text-text-tertiary">Histórico de OS concluídas</p>
        </div>
      </div>

      {systemTypes.length > 0 && (
        <div className="flex gap-2 flex-wrap tap-highlight-none">
          {systemTypes.map((type) => {
            const active = filters.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className="hl-chip"
                data-active={active ? 'true' : undefined}
              >
                {SYSTEM_TYPE_LABELS[type] ?? type}
              </button>
            );
          })}
          {filters.length > 0 && (
            <button
              onClick={() => setFilters([])}
              className="hl-chip"
            >
              Limpar
            </button>
          )}
        </div>
      )}

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
        <div className="relative pl-8 space-y-7">
          <div className="absolute bottom-0 left-3 top-0 w-0.5 bg-border-subtle" />
          {filtered.map((order) => (
            <TimelineCard
              key={order.id}
              order={order}
              onPhotoClick={setLightbox}
            />
          ))}

          {hasMore && (
            <div className="relative flex justify-center pt-2">
              <div className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-border-subtle">
                <GitCommitVertical className="-ml-px -mt-px h-3 w-3 text-text-tertiary" />
              </div>
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
