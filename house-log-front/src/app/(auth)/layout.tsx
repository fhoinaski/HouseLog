'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('hl_token'));

  useEffect(() => {
    if (hasToken) {
      router.replace('/dashboard');
    }
  }, [hasToken, router]);

  if (hasToken) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
