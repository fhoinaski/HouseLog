'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth-context';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const queryString = typeof window !== 'undefined' ? window.location.search : '';
      const currentRoute = `${pathname || '/provider/dashboard'}${queryString}`;
      const next = encodeURIComponent(currentRoute || '/provider/dashboard');
      router.replace(`/login?next=${next}`);
      return;
    }

    if (!loading && user && user.role !== 'provider' && user.role !== 'admin' && user.role !== 'temp_provider') {
      router.replace('/dashboard');
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) return null;
  if (user.role !== 'provider' && user.role !== 'admin' && user.role !== 'temp_provider') return null;

  return <AppShell>{children}</AppShell>;
}
