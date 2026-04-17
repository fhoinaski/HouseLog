'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Building2, Wrench, Package, FileText, BarChart3,
  Home, RefreshCw, Search, Activity,
} from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import type { Property } from '@/lib/api';
import { PROPERTY_TYPE_LABELS } from '@/lib/utils';

const STATIC_COMMANDS = [
  { id: 'new-property', label: 'Novo Imóvel', icon: Building2, href: '/properties/new' },
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/dashboard' },
];

function PropertyCommands({ properties, onSelect }: { properties: Property[]; onSelect: (href: string) => void }) {
  return (
    <>
      {properties.map((p) => (
        <Command.Item key={p.id} value={`${p.name} ${p.city}`} onSelect={() => onSelect(`/properties/${p.id}`)}>
          <Building2 className="h-4 w-4 shrink-0 text-primary-500" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{p.name}</span>
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">{p.city}</span>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">{PROPERTY_TYPE_LABELS[p.type]}</span>
        </Command.Item>
      ))}
    </>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data: properties } = usePagination<Property>('/properties');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col" shouldFilter>
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <Search className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
            <Command.Input
              placeholder="Buscar imóveis, navegar..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-[var(--border)] px-1.5 text-[10px] font-mono text-[var(--muted-foreground)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 [&_[cmdk-item]]:flex [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item][aria-selected]]:bg-[var(--muted)]">
            <Command.Empty className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Nenhum resultado encontrado
            </Command.Empty>

            {properties.length > 0 && (
              <Command.Group heading={<span className="px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Imóveis</span>}>
                <PropertyCommands properties={properties.slice(0, 8)} onSelect={select} />
              </Command.Group>
            )}

            <Command.Group heading={<span className="px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Ações</span>}>
              {STATIC_COMMANDS.map((cmd) => (
                <Command.Item key={cmd.id} value={cmd.label} onSelect={() => select(cmd.href)}>
                  <cmd.icon className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  <span className="text-sm">{cmd.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
