'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Package, Wallet, Wrench } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const propertyMatch = pathname.match(/^\/properties\/([^/]+)/);
  const propertyId = propertyMatch?.[1];
  const isPropertyContext = Boolean(propertyId && propertyId !== 'new');

  const propertyBottomNav = propertyId
    ? [
      { href: `/properties/${propertyId}`, label: 'Resumo', icon: Building2 },
      { href: `/properties/${propertyId}/inventory`, label: 'Inventário', icon: Package },
      { href: `/properties/${propertyId}/services`, label: 'Serviços', icon: Wrench },
      { href: `/properties/${propertyId}/financial`, label: 'Financeiro', icon: Wallet },
    ]
    : [];

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }

    if (!loading && user && (user.role === 'provider' || user.role === 'temp_provider')) {
      router.replace('/provider/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-primary-500/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary-500" />
        </div>
      </div>
    );
  }

  if (!user || user.role === 'provider' || user.role === 'temp_provider') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:ml-64">
        <main className="flex-1 overflow-y-auto">
          <div className={cn(
            'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in',
            isPropertyContext && 'pb-28 md:pb-8'
          )}>
            {children}
          </div>
        </main>

        {isPropertyContext && (
          <nav
            className="fixed left-1/2 z-50 flex w-[92%] max-w-lg -translate-x-1/2 items-stretch gap-1 rounded-xl bg-(--surface-container-highest)/90 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl lg:hidden"
            style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {propertyBottomNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex flex-1 min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 transition-all',
                    active
                      ? 'bg-primary-400/10 text-primary-400'
                      : 'text-zinc-400 hover:text-emerald-400'
                  )}
                >
                  <Icon className="mb-1 h-5 w-5" />
                  <span className="max-w-full truncate text-center text-[9px] font-bold uppercase leading-none tracking-[0.04em]">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
