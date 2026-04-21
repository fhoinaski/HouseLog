'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { BarChart3, ChevronRight, Plus, ReceiptText, WalletCards } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FinancialPage() {
  const { data, isLoading } = useSWR('financial-properties', () => propertiesApi.list(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  });

  const properties = data?.data ?? [];

  return (
    <div className="mx-auto max-w-[980px] space-y-4 safe-bottom">
      <Card variant="raised" density="comfortable">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="success">Financeiro</Badge>
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                  Custos e governança
                </span>
              </div>
              <h1 className="text-2xl font-medium leading-tight text-text-primary sm:text-3xl">
                Financeiro por imóvel
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                A consolidação financeira global está em preparação. Hoje, despesas, histórico e resumo financeiro são operados dentro de cada imóvel.
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
          <div className="flex items-start gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-success text-text-success">
              <WalletCards className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">Custos vinculados ao prontuário</p>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Escolha um imóvel para abrir despesas, resumos e registros financeiros ligados ao histórico técnico.
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
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-6 text-center">
              <ReceiptText className="mx-auto h-8 w-8 text-text-tertiary" />
              <p className="mt-3 text-sm font-medium text-text-primary">Nenhum imóvel para financeiro</p>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Cadastre o primeiro ativo para registrar despesas e acompanhar custos por imóvel.
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
                  href={`/properties/${property.id}/financial`}
                  className="group flex min-h-20 items-center gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-3 transition-colors hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-success text-text-success">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{property.name}</p>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">{property.city || property.address}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-disabled transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
