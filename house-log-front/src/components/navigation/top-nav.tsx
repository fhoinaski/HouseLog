'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getNavItems, isNavItemActive } from './nav-config';

export function TopNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const items = getNavItems(user?.role);

  const fullName = user?.name ?? '';
  const initials =
    fullName
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0] ?? '')
      .join('')
      .toUpperCase() || 'U';

  const firstName = fullName.split(' ')[0] ?? '';

  const profileHref = user?.role === 'provider' || user?.role === 'temp_provider'
    ? '/provider/settings'
    : '/settings';

  const avatarColors =
    user?.role === 'owner'
      ? { bg: 'var(--color-avatar-owner-bg)', fg: 'var(--color-avatar-owner-fg)' }
      : user?.role === 'provider' || user?.role === 'temp_provider'
        ? { bg: 'var(--color-avatar-provider-bg)', fg: 'var(--color-avatar-provider-fg)' }
        : { bg: 'var(--color-avatar-manager-bg)', fg: 'var(--color-avatar-manager-fg)' };

  return (
    <>
      <div className="hidden h-14 shrink-0 md:block" aria-hidden="true" />

      <header
        className="fixed left-0 right-0 top-0 hidden h-13 items-center border-b border-neutral-100 bg-(--hl-bg-card) px-4 md:flex"
        style={{ zIndex: 'var(--z-nav)' }}
      >
        <Link
          href={user?.role === 'provider' || user?.role === 'temp_provider' ? '/provider/dashboard' : '/dashboard'}
          className="flex shrink-0 items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-100">
            <Home size={16} strokeWidth={1.8} className="text-(--color-primary)" />
          </div>
          <span className="text-[15px] font-medium tracking-tight text-(--hl-text-primary)">HouseLog</span>
        </Link>

        <nav
          className="absolute left-1/2 flex h-13 -translate-x-1/2 items-center"
          aria-label="Navegacao principal"
        >
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex h-full items-center gap-1.5 border-b-2 px-4 text-[13px] font-medium transition-colors duration-150 ' +
                  (active
                    ? 'border-(--color-primary) text-(--hl-text-primary)'
                    : 'border-transparent text-neutral-600 hover:border-neutral-100 hover:text-neutral-800')
                }
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="hidden md:block" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href={profileHref} className="group ml-auto flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: avatarColors.bg }}>
            <span className="text-[11px] font-medium" style={{ color: avatarColors.fg }}>{initials}</span>
          </div>
          <span className="hidden text-[13px] font-medium text-neutral-600 transition-colors group-hover:text-(--hl-text-primary) lg:block">
            {firstName}
          </span>
        </Link>
      </header>
    </>
  );
}
