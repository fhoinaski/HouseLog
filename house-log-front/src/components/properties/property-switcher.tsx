'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeftRight, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { propertiesApi, type Property } from '@/lib/api';
import { cn } from '@/lib/utils';

type PropertySwitcherProps = {
  propertyId: string;
  triggerClassName?: string;
  triggerLabel?: string;
  compact?: boolean;
};

function nextPropertyHref(pathname: string, currentPropertyId: string, nextPropertyId: string) {
  const prefix = `/properties/${currentPropertyId}`;
  if (pathname === prefix) return `/properties/${nextPropertyId}`;
  if (!pathname.startsWith(`${prefix}/`)) return `/properties/${nextPropertyId}`;
  return `/properties/${nextPropertyId}${pathname.slice(prefix.length)}`;
}

function matchesProperty(property: Property, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [property.name, property.city, property.address]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized));
}

export function PropertySwitcher({
  propertyId,
  triggerClassName,
  triggerLabel = 'Trocar imovel',
  compact = false,
}: PropertySwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: currentData } = useSWR(['property', propertyId], () => propertiesApi.get(propertyId));
  const { data, isLoading } = useSWR(open ? ['properties', 'switcher'] : null, () =>
    propertiesApi.list({ limit: 100 })
  );

  const currentProperty = currentData?.property;
  const filteredProperties = useMemo(() => {
    const properties = data?.data ?? [];
    return properties.filter((property) => matchesProperty(property, query));
  }, [data?.data, query]);

  function switchProperty(nextPropertyId: string) {
    setOpen(false);
    router.push(nextPropertyHref(pathname, propertyId, nextPropertyId));
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? 'ghost' : 'outline'}
        size={compact ? 'icon' : 'default'}
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
        {!compact && <span>{triggerLabel}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar imovel</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
              <p className="text-xs text-text-tertiary">Imovel atual</p>
              <p className="truncate text-sm font-medium text-text-primary">
                {currentProperty?.name ?? 'Carregando imovel'}
              </p>
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, cidade ou endereco"
                className="pl-9"
                autoFocus
              />
            </label>

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {isLoading && (
                <>
                  <div className="hl-skeleton h-14 rounded-[var(--radius-lg)]" />
                  <div className="hl-skeleton h-14 rounded-[var(--radius-lg)]" />
                  <div className="hl-skeleton h-14 rounded-[var(--radius-lg)]" />
                </>
              )}

              {!isLoading && filteredProperties.length === 0 && (
                <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-6 text-center text-sm text-text-secondary">
                  Nenhum imovel encontrado
                </div>
              )}

              {filteredProperties.map((property) => {
                const active = property.id === propertyId;
                return (
                  <button
                    key={property.id}
                    type="button"
                    disabled={active}
                    onClick={() => switchProperty(property.id)}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                      active
                        ? 'cursor-default bg-bg-accent-subtle text-text-accent'
                        : 'bg-bg-subtle text-text-primary hover:bg-bg-muted'
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{property.name}</span>
                      <span className="block truncate text-xs text-text-tertiary">
                        {property.address}, {property.city}
                      </span>
                    </span>
                    {active && <span className="text-xs font-medium">Atual</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
