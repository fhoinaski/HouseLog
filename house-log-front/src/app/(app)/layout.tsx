import { TopNav } from '@/components/navigation';
import { BottomNav } from '@/components/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-page">
      <TopNav />
      <main className="safe-top safe-bottom flex-1">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
