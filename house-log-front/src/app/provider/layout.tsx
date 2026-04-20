'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth-context';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }

    if (!loading && user && user.role !== 'provider' && user.role !== 'admin' && user.role !== 'temp_provider') {
      router.replace('/dashboard');
    }
  }, [loading, router, user]);

  if (loading || !user) return null;
  if (user.role !== 'provider' && user.role !== 'admin' && user.role !== 'temp_provider') return null;

  return <AppShell>{children}</AppShell>;
}
