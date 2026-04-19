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
      <div className="safe-top safe-bottom flex h-screen items-center justify-center bg-bg-page">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-focus border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
