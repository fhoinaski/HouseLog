'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Home,
  ImageIcon,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { propertiesApi, type PropertyTimelineEvent, type PropertyTimelineEventType } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDate } from '@/lib/utils';

const EVENT_CONFIG: Record<PropertyTimelineEventType, {
  label: string;
  icon: LucideIcon;
  tone: 'neutral' | 'success' | 'warning' | 'critical';
}> = {
  property_created: { label: 'Imovel', icon: Building2, tone: 'neutral' },
  room_created: { label: 'Ambiente', icon: Home, tone: 'neutral' },
  document_uploaded: { label: 'Documento', icon: FileText, tone: 'neutral' },
  warranty_created: { label: 'Garantia', icon: ShieldCheck, tone: 'success' },
  service_request_opened: { label: 'Chamado', icon: ClipboardCheck, tone: 'warning' },
  diagnostic_recorded: { label: 'Diagnostico', icon: Sparkles, tone: 'success' },
  service_order_created: { label: 'OS criada', icon: Wrench, tone: 'neutral' },
  service_order_completed: { label: 'OS concluida', icon: CheckCircle2, tone: 'success' },
  evidence_uploaded: { label: 'Evidencia', icon: ImageIcon, tone: 'neutral' },
  inventory_updated: { label: 'Inventario', icon: Package, tone: 'neutral' },
  renovation_completed: { label: 'Reforma', icon: RefreshCw, tone: 'success' },
  dossier_issued: { label: 'Dossie', icon: FileText, tone: 'success' },
  handover_accepted: { label: 'Handover', icon: ClipboardCheck, tone: 'success' },
};

type TimelineFilter = 'all' | 'service_orders' | 'documents' | 'warranties' | 'requests' | 'evidence' | 'inventory' | 'handover';

const FILTERS: Array<{ value: TimelineFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'service_orders', label: 'OS' },
  { value: 'documents', label: 'Documentos' },
  { value: 'warranties', label: 'Garantias' },
  { value: 'requests', label: 'Chamados' },
  { value: 'evidence', label: 'Evidencias' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'handover', label: 'Handover' },
];

function toneClass(tone: 'neutral' | 'success' | 'warning' | 'critical'): string {
  switch (tone) {
    case 'success':
      return 'bg-[color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))] text-hl-success';
    case 'warning':
      return 'bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))] text-hl-warning';
    case 'critical':
      return 'bg-[color-mix(in_srgb,var(--hl-danger)_12%,var(--hl-surface))] text-hl-danger';
    default:
      return 'bg-hl-surface-muted text-hl-text-muted';
  }
}

function eventHref(propertyId: string, event: PropertyTimelineEvent): string {
  switch (event.entity_type) {
    case 'room':
      return `/properties/${propertyId}?tab=rooms`;
    case 'document':
    case 'document_ingestion':
      return `/properties/${propertyId}?tab=documents`;
    case 'warranty':
      return `/properties/${propertyId}?tab=warranties`;
    case 'service_request':
      return `/properties/${propertyId}?tab=tickets`;
    case 'service_order':
      return `/properties/${propertyId}/services/${event.entity_id}`;
    case 'inventory_item':
      return `/properties/${propertyId}?tab=inventory`;
    case 'handover_package':
      return `/properties/${propertyId}?tab=handover`;
    case 'renovation':
      return `/properties/${propertyId}/renovations`;
    default:
      return `/properties/${propertyId}`;
  }
}

function groupEvents(events: PropertyTimelineEvent[]): Array<{ label: string; events: PropertyTimelineEvent[] }> {
  const groups: Array<{ label: string; events: PropertyTimelineEvent[] }> = [];

  for (const event of events) {
    const date = new Date(event.at);
    const label = Number.isNaN(date.getTime())
      ? 'Sem data'
      : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
    const current = groups.at(-1);
    if (current?.label === label) {
      current.events.push(event);
    } else {
      groups.push({ label, events: [event] });
    }
  }

  return groups;
}

function matchesFilter(event: PropertyTimelineEvent, filter: TimelineFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'service_orders') return event.type === 'service_order_created' || event.type === 'service_order_completed';
  if (filter === 'documents') return event.type === 'document_uploaded' || event.type === 'diagnostic_recorded';
  if (filter === 'warranties') return event.type === 'warranty_created';
  if (filter === 'requests') return event.type === 'service_request_opened';
  if (filter === 'evidence') return event.type === 'evidence_uploaded';
  if (filter === 'inventory') return event.type === 'inventory_updated';
  return event.type === 'dossier_issued' || event.type === 'handover_accepted';
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando timeline tecnica">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
          <div className="hl-skeleton mt-1 h-3 w-3 rounded-full" />
          <div className="hl-skeleton h-24 rounded-[var(--hl-radius-card)]" />
        </div>
      ))}
    </div>
  );
}

function TimelineEventCard({ propertyId, event }: { propertyId: string; event: PropertyTimelineEvent }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;
  const href = eventHref(propertyId, event);
  const tone = event.severity === 'neutral' ? config.tone : event.severity;

  return (
    <article className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
      <span className={cn('mt-1 flex h-6 w-6 items-center justify-center rounded-full', toneClass(tone))}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>

      <Card variant="section" density="compact" className="min-w-0 border border-hl-border bg-hl-surface shadow-hl-subtle">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', toneClass(tone))}>
                  {config.label}
                </span>
                <time className="text-xs text-hl-text-muted" dateTime={event.at}>
                  {formatDate(event.at)}
                </time>
              </div>
              <h3 className="mt-2 text-sm font-medium leading-5 text-hl-text">{event.title}</h3>
              {event.description && (
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-hl-text-muted">{event.description}</p>
              )}
            </div>

            <Button asChild variant="ghost" size="sm" className="w-full shrink-0 text-hl-primary sm:w-auto">
              <Link href={href}>Abrir</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

export function PropertyTimelinePanel({ propertyId, compact = false }: { propertyId: string; compact?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR(['property-timeline', propertyId], () =>
    propertiesApi.timeline(propertyId, { limit: compact ? 20 : 80 })
  );
  const events = data?.data ?? [];
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const visibleEvents = events.filter((event) => matchesFilter(event, activeFilter));
  const groups = groupEvents(visibleEvents);

  return (
    <section className="space-y-4" aria-label="Timeline tecnica do imovel">
      <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-hl-primary">Memoria tecnica viva</p>
            <h2 className="mt-1.5 text-xl font-semibold leading-tight text-hl-text sm:text-2xl">
              Timeline tecnica
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-hl-text-muted">
              Eventos seguros do prontuario: documentos, garantias, chamados, OS, evidencias, inventario e handover.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar eventos da timeline">
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.value;
              return (
                <Button
                  key={filter.value}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <TimelineSkeleton />
      ) : error ? (
        <Card variant="section" density="comfortable" className="border border-hl-border bg-hl-surface shadow-hl-subtle">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-[color-mix(in_srgb,var(--hl-danger)_12%,var(--hl-surface))] text-hl-danger">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-hl-text">Nao foi possivel carregar a timeline</h3>
              <p className="mt-1 text-sm leading-6 text-hl-text-muted">
                A memoria tecnica nao foi exibida agora. Tente novamente em instantes.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void mutate()}>
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : visibleEvents.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title={activeFilter === 'all' ? 'Nenhum evento tecnico registrado' : 'Nenhum evento para este filtro'}
          description={
            activeFilter === 'all'
              ? 'A timeline sera formada conforme documentos, OS, evidencias, inventario, garantias e handover forem registrados.'
              : 'Ajuste o filtro para consultar outros eventos do prontuario tecnico.'
          }
          actions={
            activeFilter !== 'all' ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveFilter('all')}>
                Limpar filtros
              </Button>
            ) : null
          }
          tone="subtle"
        />
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-baseline gap-3">
                <h3 className="text-sm font-medium capitalize text-hl-text">{group.label}</h3>
                <span className="text-xs text-hl-text-muted">
                  {group.events.length} evento{group.events.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="relative space-y-3">
                <div className="absolute bottom-0 left-3 top-0 w-px bg-hl-border" aria-hidden="true" />
                {group.events.map((event) => (
                  <TimelineEventCard key={event.id} propertyId={propertyId} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
