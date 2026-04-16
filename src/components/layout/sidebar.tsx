'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, LayoutDashboard, Package, Wrench, FileText,
  BarChart3, Settings, LogOut, Menu, X, Home, RefreshCw, Activity,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/properties',   label: 'Imóveis',    icon: Building2 },
];

const PROPERTY_NAV = (id: string) => [
  { href: `/properties/${id}`,               label: 'Visão Geral',  icon: Building2 },
  { href: `/properties/${id}/rooms`,         label: 'Cômodos',      icon: Home },
  { href: `/properties/${id}/inventory`,     label: 'Inventário',   icon: Package },
  { href: `/properties/${id}/services`,      label: 'Serviços',     icon: Wrench },
  { href: `/properties/${id}/maintenance`,   label: 'Manutenção',   icon: RefreshCw },
  { href: `/properties/${id}/documents`,     label: 'Documentos',   icon: FileText },
  { href: `/properties/${id}/financial`,     label: 'Financeiro',   icon: BarChart3 },
  { href: `/properties/${id}/report`,        label: 'Relatório',    icon: Activity },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Extract propertyId if on a property route
  const propertyMatch = pathname.match(/^\/properties\/([^/]+)/);
  const propertyId = propertyMatch?.[1];

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden rounded-md bg-slate-900 p-2 text-white"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 flex flex-col bg-slate-900 text-slate-100 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">HouseLog</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          {/* Property sub-nav */}
          {propertyId && propertyId !== 'new' && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Imóvel atual
              </p>
              {PROPERTY_NAV(propertyId).map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    pathname === href
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* User + Settings */}
        <div className="border-t border-slate-700 p-3 space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          {user && (
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
