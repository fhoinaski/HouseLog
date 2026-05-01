'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { FileText, Hammer, PackageSearch, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { searchApi, type SearchResult } from '@/lib/api';

type PropertyContextSearchProps = {
  propertyId: string;
};

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  service: 'Servicos',
  document: 'Documentos',
  inventory: 'Inventario',
  maintenance: 'Manutencao',
};

const TYPE_ICONS: Record<SearchResult['type'], typeof Wrench> = {
  service: Wrench,
  document: FileText,
  inventory: PackageSearch,
  maintenance: Hammer,
};

export function PropertyContextSearch({ propertyId }: PropertyContextSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim();

  const { data, isLoading } = useSWR(
    open && normalizedQuery.length >= 2 ? ['property-context-search', propertyId, normalizedQuery] : null,
    () => searchApi.search(normalizedQuery, propertyId),
    { keepPreviousData: true }
  );

  const groupedResults = useMemo(() => {
    const groups = new Map<SearchResult['type'], SearchResult[]>();
    for (const result of data?.results ?? []) {
      const current = groups.get(result.type) ?? [];
      groups.set(result.type, [...current, result]);
    }
    return Array.from(groups.entries());
  }, [data?.results]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Buscar neste imovel"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar neste imovel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar neste imovel..."
                className="pl-9"
                autoFocus
              />
            </label>

            {normalizedQuery.length < 2 && (
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-6 text-center text-sm text-text-secondary">
                Digite pelo menos 2 caracteres para buscar servicos, documentos, inventario e manutencoes.
              </div>
            )}

            {normalizedQuery.length >= 2 && isLoading && (
              <div className="space-y-2">
                <div className="hl-skeleton h-14 rounded-[var(--radius-lg)]" />
                <div className="hl-skeleton h-14 rounded-[var(--radius-lg)]" />
              </div>
            )}

            {normalizedQuery.length >= 2 && !isLoading && groupedResults.length === 0 && (
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-6 text-center text-sm text-text-secondary">
                Nenhum resultado encontrado neste imovel.
              </div>
            )}

            <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
              {groupedResults.map(([type, results]) => {
                const Icon = TYPE_ICONS[type];
                return (
                  <section key={type} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {TYPE_LABELS[type]}
                    </div>
                    <div className="space-y-2">
                      {results.map((result) => (
                        <Link
                          key={`${result.type}-${result.id}`}
                          href={result.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2 transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                        >
                          <span className="block truncate text-sm font-medium text-text-primary">{result.title}</span>
                          <span className="block truncate text-xs text-text-secondary">{result.subtitle}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
