'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Wrench, LogOut, Building2, Briefcase, Settings, Bell,
} from 'lucide-react';

const NAV = [
  { href: '/provider/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/provider/opportunities', label: 'Orçamentos', icon: Briefcase },
  { href: '/provider/services',  label: 'Minhas OS',  icon: Wrench },
  { href: '/provider/settings', label: 'Configurações', icon: Settings },
];

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'provider' && user.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const current = NAV.find((item) => pathname.startsWith(item.href));

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_80%_-10%,var(--provider-surface),transparent),var(--background)] text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--provider-accent) text-white shadow-lg shadow-primary-600/30">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold leading-tight">HouseLog</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Portal Prestador</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-xl border border-border bg-card px-3 py-1.5">
              <p className="text-xs font-medium truncate max-w-40">{user.name}</p>
            </div>
            <button
              type="button"
              aria-label="Notificacoes"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:flex lg:min-h-[calc(100vh-64px)] lg:flex-col lg:border-r lg:border-border/70 lg:bg-card/60 lg:backdrop-blur-sm">
          <nav className="flex-1 space-y-1 p-4">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  pathname.startsWith(href)
                    ? 'bg-(--provider-surface) text-(--provider-accent-strong) border border-(--provider-divider)'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-border/70 p-4 space-y-2">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-rose-500 hover:border-rose-300/50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        <main className="px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8">
          <div className="mb-4 lg:hidden">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Area atual</p>
            <h1 className="text-lg font-bold">{current?.label ?? 'Portal Prestador'}</h1>
          </div>
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-4 z-50 px-4 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border/80 bg-card/90 p-2 shadow-xl backdrop-blur-xl">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex w-[23%] flex-col items-center rounded-xl px-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-all',
                  active
                    ? 'bg-(--provider-surface) text-(--provider-accent-strong)'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                <span className="truncate max-w-full">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
