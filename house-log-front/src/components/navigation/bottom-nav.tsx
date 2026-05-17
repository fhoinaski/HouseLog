'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getPropertyContext } from '@/components/properties/property-route-context';
import { PropertyMobileContextControls } from './property-mobile-context-controls';
import { getNavItems, isNavItemActive } from './nav-config';

export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const propertyContext = getPropertyContext(pathname);

  if (propertyContext) {
    return <PropertyMobileContextControls propertyId={propertyContext.propertyId} />;
  }

  const items = getNavItems(user?.role);

  return (
    <>
      <div
        className="block shrink-0 md:hidden"
        style={{ height: 'calc(var(--nav-height-bottom) + 24px + env(safe-area-inset-bottom))' }}
        aria-hidden="true"
      />

      <nav aria-label="Navegação principal" className="fixed bottom-0 left-0 right-0 z-sticky px-4 pb-3 md:hidden">
        <div
          className="nav-dock mx-auto flex max-w-md items-center justify-around rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-2 pt-2 shadow-hl-soft"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={
                  'nav-dock-item tap-highlight-none flex min-h-11 min-w-14 flex-col items-center justify-center gap-[3px] rounded-[var(--radius-md)] px-2 transition-colors focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] ' +
                  (active ? 'bg-hl-surface-muted' : 'hover:bg-hl-surface-muted')
                }
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
