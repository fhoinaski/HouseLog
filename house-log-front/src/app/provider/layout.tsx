'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Wrench, LogOut, Building2,
} from 'lucide-react';

const NAV = [
  { href: '/provider/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/provider/services',  label: 'Minhas OS',  icon: Wrench },
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

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-40 h-full w-60 flex flex-col bg-slate-900 text-slate-100">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">HouseLog</p>
            <p className="text-xs text-slate-400">Portal Prestador</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-700 p-3 space-y-1">
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={logout}
              className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <ThemeToggle />
          </div>
          <div className="px-3 py-1">
            <p className="text-xs font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
