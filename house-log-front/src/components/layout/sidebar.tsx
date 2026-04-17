'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, Package, Wrench, FileText,
  BarChart3, Settings, LogOut, Home, RefreshCw, Activity,
  Search, Users, Download, X, KeyRound,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { CommandPalette } from '@/components/ui/command-palette';
import { usePwaInstall } from '@/lib/use-pwa-install';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Imóveis',   icon: Building2 },
];

const PROPERTY_NAV = (id: string) => [
  { href: `/properties/${id}`,             label: 'Visão Geral', icon: Building2 },
  { href: `/properties/${id}/rooms`,       label: 'Cômodos',     icon: Home },
  { href: `/properties/${id}/inventory`,   label: 'Inventário',  icon: Package },
  { href: `/properties/${id}/services`,    label: 'Serviços',    icon: Wrench },
  { href: `/properties/${id}/maintenance`, label: 'Manutenção',  icon: RefreshCw },
  { href: `/properties/${id}/documents`,   label: 'Documentos',  icon: FileText },
  { href: `/properties/${id}/financial`,   label: 'Financeiro',  icon: BarChart3 },
  { href: `/properties/${id}/team`,        label: 'Equipe',      icon: Users },
  { href: `/properties/${id}/access`,      label: 'Acessos',     icon: KeyRound },
  { href: `/properties/${id}/report`,      label: 'Relatório',   icon: Activity },
];

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { canInstall, install } = usePwaInstall();

  const propertyMatch = pathname.match(/^\/properties\/([^/]+)/);
  const propertyId = propertyMatch?.[1];
  const isProvider = user?.role === 'provider';

  const close = () => onOpenChange(false);

  const navLinkClass = (href: string, exact = false) => cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
    (exact ? pathname === href : pathname === href || pathname.startsWith(href + '/'))
      ? 'bg-[var(--sidebar-active)] text-white border-l-2 border-[var(--sidebar-active-border)] pl-[10px]'
      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border-l-2 border-transparent'
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      {/* CommandPalette */}
      <CommandPalette />

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-250 ease-out',
        'bg-[var(--sidebar-bg)]',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(79,70,229,0.04) 0%, transparent 40%)' }} />

        {/* Logo */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-700/30">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">HouseLog</span>
              <p className="text-[10px] text-slate-500 -mt-0.5 leading-none">Gestão de Imóveis</p>
            </div>
          </div>
          <button
            onClick={close}
            className="lg:hidden flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative px-3 pt-3 pb-1">
          <button
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 border border-[var(--sidebar-border)] hover:border-slate-600 hover:text-slate-400 transition-all duration-150 bg-white/[0.02] hover:bg-white/[0.04]"
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
              document.dispatchEvent(event);
            }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Menu
          </p>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={close} className={navLinkClass(href)}>
              <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" />
              {label}
            </Link>
          ))}

          {/* Property sub-nav */}
          {propertyId && propertyId !== 'new' && (
            <div className="mt-3 pt-3 border-t border-[var(--sidebar-border)]">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Imóvel atual
              </p>
              {PROPERTY_NAV(propertyId).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={close} className={navLinkClass(href, true)}>
                  <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" />
                  {label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div className="relative border-t border-[var(--sidebar-border)] p-3 space-y-1">
          {/* PWA Install */}
          {canInstall && (
            <button
              onClick={install}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all duration-150 border border-indigo-500/20 hover:border-indigo-500/30 mb-2"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              Instalar App
            </button>
          )}

          {isProvider && (
            <Link
              href="/provider/dashboard"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-all duration-150"
            >
              <Wrench className="h-4 w-4" />
              Portal Prestador
            </Link>
          )}
          <Link
            href="/settings"
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-all duration-150"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-150"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <ThemeToggle />
          </div>

          {/* User */}
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg bg-white/[0.03] border border-[var(--sidebar-border)]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-800 text-white text-xs font-bold uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
