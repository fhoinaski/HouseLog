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
        style={{ height: 'calc(var(--nav-height-bottom) + env(safe-area-inset-bottom))' }}
        aria-hidden="true"
      />

      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-sticky border-t border-border-subtle bg-nav-bg md:hidden"
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
                className="tap-highlight-none flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.75"
              >
                <Icon
                  size={22}
                  strokeWidth={1.8}
                  className={active ? 'text-nav-text-active' : 'text-nav-text-inactive'}
                  aria-hidden="true"
                />
                <span
                  className={
                    'text-xs leading-none ' +
                    (active ? 'font-medium text-nav-text-active' : 'font-regular text-nav-text-inactive')
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
