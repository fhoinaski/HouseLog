import { BottomNav } from '@/components/navigation';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
  withBottomNav?: boolean;
};

export function AppShell({
  children,
  className,
  mainClassName,
  withBottomNav = true,
}: AppShellProps) {
  return (
    <div className={cn('hl-calm-os flex min-h-screen bg-hl-bg text-hl-text', className)}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn('safe-top safe-bottom flex flex-1 flex-col', mainClassName)}>
          {children}
        </main>
        {withBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
