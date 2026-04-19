import { TopNav } from '@/components/navigation';
import { BottomNav } from '@/components/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <TopNav />
      <main className="flex-1">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
