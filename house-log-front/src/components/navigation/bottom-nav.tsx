'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getNavItems, isNavItemActive } from './nav-config';

export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const items = getNavItems(user?.role);

  return (
    <>
      <div
        className="block shrink-0 md:hidden"
        style={{ height: 'calc(56px + env(safe-area-inset-bottom))' }}
        aria-hidden="true"
      />

      <nav
        aria-label="Navegacao principal"
        className="fixed bottom-0 left-0 right-0 border-t border-neutral-100 bg-(--hl-bg-card) md:hidden"
        style={{ zIndex: 'var(--z-nav)' }}
      >
        <div
          className="flex items-center justify-around pt-2"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.75"
              >
                <Icon
                  size={22}
                  strokeWidth={1.8}
                  className={active ? 'text-(--color-primary)' : 'text-neutral-400'}
                  aria-hidden="true"
                />
                <span
                  className={
                    'text-[11px] leading-none ' +
                    (active ? 'font-medium text-(--color-primary)' : 'font-normal text-neutral-400')
                  }
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
