import { BottomNav, TopNav } from '@/components/navigation';
import { cn } from '@/lib/utils';

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
  withTopNav?: boolean;
  withBottomNav?: boolean;
};

export function AppShell({
  children,
  className,
  mainClassName,
  withTopNav = true,
  withBottomNav = true,
}: AppShellProps) {
  return (
    <div className={cn('flex min-h-screen flex-col bg-bg-page text-text-primary', className)}>
      {withTopNav && <TopNav />}
      <main className={cn('safe-top safe-bottom flex flex-1 flex-col', mainClassName)}>
        {children}
      </main>
      {withBottomNav && <BottomNav />}
    </div>
  );
}
