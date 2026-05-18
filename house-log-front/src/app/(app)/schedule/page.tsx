'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { CalendarDays, ChevronRight, Clock3, Plus, RefreshCw } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SchedulePage() {
  const { data, isLoading } = useSWR('schedule-properties', () => propertiesApi.list(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  });

  const properties = data?.data ?? [];

  return (
    <div className="mx-auto max-w-[980px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <Card variant="raised" density="comfortable">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="preventive">Agenda</Badge>
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">
                  Coordenação operacional
                </span>
              </div>
              <h1 className="text-2xl font-medium leading-tight text-hl-text sm:text-3xl">
                Agenda por imóvel
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-hl-text-muted">
                A visão global de agenda está em preparação. Hoje, os agendamentos preventivos são controlados dentro do prontuário técnico de cada imóvel.
              </p>
            </div>

            <Button asChild variant="outline" className="sm:shrink-0">
              <Link href="/properties/new">
                <Plus className="h-4 w-4" />
                Novo imóvel
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="tonal" density="comfortable">
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-[var(--hl-radius-card)] bg-hl-surface-muted p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-hl-text">Rotinas e visitas no contexto certo</p>
              <p className="mt-1 text-sm leading-6 text-hl-text-muted">
                Escolha um imóvel para abrir manutenção preventiva, recorrências e registros de execução.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="rounded-[var(--hl-radius-card)] bg-hl-surface-muted p-6 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-hl-text-muted" />
              <p className="mt-3 text-sm font-medium text-hl-text">Nenhum imóvel para agendar</p>
              <p className="mt-1 text-sm leading-6 text-hl-text-muted">
                Cadastre o primeiro ativo para criar rotinas preventivas e agenda técnica.
              </p>
              <Button asChild className="mt-4">
                <Link href="/properties/new">Adicionar imóvel</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}/maintenance`}
                  className="group flex min-h-20 items-center gap-3 rounded-[var(--hl-radius-card)] bg-hl-surface p-3 transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))] text-hl-warning">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-hl-text">{property.name}</p>
                    <p className="mt-0.5 truncate text-xs text-hl-text-muted">{property.city || property.address}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-hl-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
