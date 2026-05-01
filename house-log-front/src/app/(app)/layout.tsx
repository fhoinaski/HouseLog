import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/components/auth/require-auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RequireAuth>
        <AppShell>{children}</AppShell>
      </RequireAuth>
    </Suspense>
  );
}
