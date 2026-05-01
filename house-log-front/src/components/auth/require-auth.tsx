'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type RequireAuthProps = {
  children: React.ReactNode;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  const currentRoute = queryString ? `${pathname}?${queryString}` : pathname;

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(currentRoute || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [currentRoute, loading, router, user]);

  if (loading || !user) {
    return (
      <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page px-4">
        <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border-subtle bg-bg-surface p-6 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--interactive-secondary)] text-text-accent">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold text-text-primary">Validando sessão</p>
            <p className="text-sm text-text-secondary">Preparando o ambiente seguro do HouseLog.</p>
          </div>
          <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-text-tertiary" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
