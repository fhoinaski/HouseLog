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
  electrical:     'bg-amber-100   text-amber-700',
  plumbing:       'bg-blue-100    text-blue-700',
  structural:     'bg-slate-100   text-slate-700',
  waterproofing:  'bg-cyan-100    text-cyan-700',
  painting:       'bg-violet-100  text-violet-700',
  flooring:       'bg-orange-100  text-orange-700',
  roofing:        'bg-rose-100    text-rose-700',
  general:        'bg-gray-100    text-gray-600',
};

const SYSTEM_DOT: Record<string, string> = {
  electrical: 'bg-amber-400',
  plumbing:   'bg-blue-400',
  structural: 'bg-slate-400',
  waterproofing: 'bg-cyan-400',
  painting:   'bg-violet-400',
  flooring:   'bg-orange-400',
  roofing:    'bg-rose-400',
  general:    'bg-gray-400',
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
    <div className="relative pl-8 space-y-8">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full bg-slate-200 border-2 border-white" />
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="rounded-xl border border-slate-100 p-4 space-y-3 animate-pulse">
            <div className="h-4 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="flex gap-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-16 w-16 bg-slate-200 rounded-lg" />
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
  const badgeColor = SYSTEM_COLORS[order.system_type] ?? 'bg-slate-100 text-slate-600';
  const completedDate = order.completed_at ?? order.created_at;

  return (
    <div className="relative">
      <div className={cn('absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-white', dotColor)} />
      <p className="text-xs text-slate-400 mb-1.5">{formatDate(completedDate)}</p>

      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm leading-snug">{order.title}</p>
              {order.assigned_to_name && (
                <p className="text-xs text-slate-400 mt-0.5">{order.assigned_to_name}</p>
              )}
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', badgeColor)}>
              {SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type}
            </span>
          </div>

          {/* Description */}
          {order.description && (
            <p className="text-xs text-slate-500 line-clamp-2">{order.description}</p>
          )}

          {/* Photos */}
          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <div className="space-y-1.5">
              {beforePhotos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Antes</p>
                  <div className="flex gap-2 flex-wrap">
                    {beforePhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`antes-${i + 1}`}
                          className="h-16 w-16 rounded-lg object-cover border border-slate-200 group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="h-5 w-5 text-white drop-shadow" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {afterPhotos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Depois</p>
                  <div className="flex gap-2 flex-wrap">
                    {afterPhotos.map((url, i) => (
                      <button key={i} onClick={() => onPhotoClick(url)} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`depois-${i + 1}`}
                          className="h-16 w-16 rounded-lg object-cover border border-slate-200 group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="h-5 w-5 text-white drop-shadow" />
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
            <p className="text-xs text-slate-500 font-medium">
              Custo: <span className="text-slate-700">{formatCurrency(order.cost)}</span>
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
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/properties/${id}/services`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-bold">Timeline de Manutenção</h2>
          <p className="text-xs text-slate-400">Histórico de OS concluídas</p>
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
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                )}
              >
                {SYSTEM_TYPE_LABELS[type] ?? type}
              </button>
            );
          })}
          {filters.length > 0 && (
            <button
              onClick={() => setFilters([])}
              className="rounded-full px-3 py-1 text-xs font-medium border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
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
          <CheckCircle2 className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">
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
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
          {filtered.map((order) => (
            <TimelineCard
              key={order.id}
              order={order}
              onPhotoClick={setLightbox}
            />
          ))}

          {hasMore && (
            <div className="relative flex justify-center pt-2">
              <div className="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full bg-slate-200 border-2 border-white">
                <GitCommitVertical className="h-3 w-3 text-slate-400 -ml-px -mt-px" />
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
