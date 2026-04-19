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
      .join('') || 'U';

  const firstName = fullName.split(' ')[0] ?? '';

  const profileHref = user?.role === 'provider' || user?.role === 'temp_provider'
    ? '/provider/settings'
    : '/settings';

  const avatarColors =
    user?.role === 'owner'
      ? { bg: 'var(--avatar-owner-bg)', fg: 'var(--avatar-owner-text)' }
      : user?.role === 'provider' || user?.role === 'temp_provider'
        ? { bg: 'var(--avatar-provider-bg)', fg: 'var(--avatar-provider-text)' }
        : { bg: 'var(--avatar-manager-bg)', fg: 'var(--avatar-manager-text)' };

  return (
    <>
      <div className="hidden h-14 shrink-0 md:block" aria-hidden="true" />

      <header
        className="fixed left-0 right-0 top-0 z-sticky hidden h-13 items-center border-b border-border-subtle bg-nav-bg px-4 md:flex"
      >
        <Link
          href={user?.role === 'provider' || user?.role === 'temp_provider' ? '/provider/dashboard' : '/dashboard'}
          className="flex shrink-0 items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-half border-border-subtle">
            <Home size={16} strokeWidth={1.8} className="text-nav-text-active" />
          </div>
          <span className="text-md font-medium tracking-tight text-text-inverse">HouseLog</span>
        </Link>

        <nav
          className="absolute left-1/2 flex h-13 -translate-x-1/2 items-center"
          aria-label="Navegação principal"
        >
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors duration-150 ' +
                  (active
                    ? 'border-nav-text-active text-nav-text-active'
                    : 'border-transparent text-nav-text-inactive hover:border-border-subtle hover:text-text-inverse')
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
            <span className="text-xs font-medium" style={{ color: avatarColors.fg }}>{initials}</span>
          </div>
          <span className="hidden text-sm font-medium text-nav-text-inactive transition-colors group-hover:text-nav-text-active lg:block">
            {firstName}
          </span>
        </Link>
      </header>
    </>
  );
}
