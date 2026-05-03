'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  Layers3,
  Map,
  Menu,
  Pencil,
  ReceiptText,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PropertySwitcher } from '@/components/properties/property-switcher';
import { cn } from '@/lib/utils';

type PropertyMobileContextControlsProps = {
  propertyId: string;
};

const mainItems = [
  { label: 'Inicio', segment: '', icon: Home },
  { label: 'Mapa', segment: 'map', icon: Map },
  { label: 'Sistemas', segment: 'systems', icon: Layers3 },
  { label: 'Servicos', segment: 'services', icon: Wrench },
];

const moreItems = [
  { label: 'Orcamentos', segment: 'service-requests', icon: ClipboardList },
  { label: 'Documentos', segment: 'documents', icon: FileText },
  { label: 'Ambientes', segment: 'rooms', icon: Building2 },
  { label: 'Equipe', segment: 'team', icon: Users },
  { label: 'Manutencao', segment: 'maintenance', icon: RefreshCw },
  { label: 'Reformas', segment: 'renovations', icon: FolderKanban },
  { label: 'Inventario', segment: 'inventory', icon: ClipboardList },
  { label: 'Timeline', segment: 'timeline', icon: ArrowLeftRight },
  { label: 'Financeiro', segment: 'financial', icon: ReceiptText },
  { label: 'Relatorio', segment: 'report', icon: ScrollText },
  { label: 'Garantias', segment: 'warranties', icon: ShieldCheck },
  { label: 'Editar imovel', segment: 'edit', icon: Pencil },
];

function hrefFor(propertyId: string, segment: string) {
  return segment ? `/properties/${propertyId}/${segment}` : `/properties/${propertyId}`;
}

function isActive(pathname: string, propertyId: string, segment: string) {
  const href = hrefFor(propertyId, segment);
  if (!segment) return pathname === href;
  if (segment === 'services') return pathname === href || pathname.startsWith(`${href}/`);
  if (segment === 'service-requests') return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PropertyMobileContextControls({ propertyId }: PropertyMobileContextControlsProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = useMemo(
    () => moreItems.some((item) => isActive(pathname, propertyId, item.segment)),
    [pathname, propertyId]
  );

  return (
    <>
      <div
        className="block shrink-0 md:hidden"
        style={{ height: 'calc(var(--nav-height-bottom) + 12px + env(safe-area-inset-bottom))' }}
        aria-hidden="true"
      />

      <nav aria-label="Navegacao do imovel" className="fixed bottom-0 left-0 right-0 z-sticky px-4 pb-3 md:hidden">
        <div
          className="nav-dock mx-auto flex max-w-md items-center justify-around rounded-[var(--radius-xl)] bg-nav-bg/95 px-2 pt-2 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.7)] backdrop-blur-[var(--surface-blur)]"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
          {mainItems.map((item) => {
            const active = isActive(pathname, propertyId, item.segment);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={hrefFor(propertyId, item.segment)}
                aria-label={item.label}
                data-active={active}
                className={cn(
                  'nav-dock-item tap-highlight-none flex min-h-11 min-w-14 flex-col items-center justify-center gap-[3px] rounded-[var(--radius-md)] px-2 transition-colors focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                  active ? 'bg-white/10' : 'hover:bg-white/5'
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={1.8}
                  className={active ? 'text-nav-text-active' : 'text-nav-text-inactive'}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-xs leading-none',
                    active ? 'font-medium text-nav-text-active' : 'font-regular text-nav-text-inactive'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Mais modulos do imovel"
            aria-expanded={moreOpen}
            data-active={moreActive}
            onClick={() => setMoreOpen(true)}
            className={cn(
              'nav-dock-item tap-highlight-none flex min-h-11 min-w-14 flex-col items-center justify-center gap-[3px] rounded-[var(--radius-md)] px-2 transition-colors focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
              moreActive ? 'bg-white/10' : 'hover:bg-white/5'
            )}
          >
            <Menu
              size={22}
              strokeWidth={1.8}
              className={moreActive ? 'text-nav-text-active' : 'text-nav-text-inactive'}
              aria-hidden="true"
            />
            <span className={cn('text-xs leading-none', moreActive ? 'font-medium text-nav-text-active' : 'font-regular text-nav-text-inactive')}>
              Mais
            </span>
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="bottom-0 top-auto w-full max-w-none translate-y-0 rounded-b-none rounded-t-[var(--radius-2xl)] border-x-0 border-b-0 px-4 pb-5 pt-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom">
          <DialogHeader className="pr-10">
            <DialogTitle>Modulos do imovel</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {moreItems.filter((item) => item.segment !== 'edit').map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, propertyId, item.segment);
              return (
                <Link
                  key={item.segment}
                  href={hrefFor(propertyId, item.segment)}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-[var(--radius-lg)] bg-bg-subtle px-3 text-sm text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                    active && 'bg-bg-accent-subtle text-text-accent'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
            <PropertySwitcher
              propertyId={propertyId}
              triggerLabel="Trocar imovel"
              triggerClassName="col-span-2 justify-start bg-bg-subtle text-text-primary hover:bg-bg-muted"
            />
            {moreItems.filter((item) => item.segment === 'edit').map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, propertyId, item.segment);
              return (
                <Link
                  key={item.segment}
                  href={hrefFor(propertyId, item.segment)}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'col-span-2 flex min-h-12 items-center gap-3 rounded-[var(--radius-lg)] bg-bg-subtle px-3 text-sm text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                    active && 'bg-bg-accent-subtle text-text-accent'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Fechar modulos"
            onClick={() => setMoreOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-text-secondary transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </DialogContent>
      </Dialog>

    </>
  );
}
