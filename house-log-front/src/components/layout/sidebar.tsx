'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { getNavItems, isNavItemActive } from '@/components/navigation/nav-config';

export function Sidebar() {
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

  const profileHref =
    user?.role === 'provider' || user?.role === 'temp_provider'
      ? '/provider/settings'
      : '/settings';

  const dashboardHref =
    user?.role === 'provider' || user?.role === 'temp_provider'
      ? '/provider/dashboard'
      : '/dashboard';

  const avatarColors =
    user?.role === 'owner'
      ? { bg: 'var(--avatar-owner-bg)', fg: 'var(--avatar-owner-text)' }
      : user?.role === 'provider' || user?.role === 'temp_provider'
        ? { bg: 'var(--avatar-provider-bg)', fg: 'var(--avatar-provider-text)' }
        : { bg: 'var(--avatar-manager-bg)', fg: 'var(--avatar-manager-text)' };

  return (
    <aside
      className="hidden md:flex w-56 shrink-0 flex-col sticky top-0 h-dvh border-r border-hl-border bg-hl-surface"
      aria-label="Menu principal"
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-hl-border px-4">
        <Link
          href={dashboardHref}
          className="flex items-center gap-2 rounded-[var(--hl-radius-control)] px-1 py-1 transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted">
            <Home size={15} strokeWidth={1.8} className="text-hl-primary" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-hl-text">HouseLog</span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? 'true' : 'false'}
              className={cn(
                'flex h-10 items-center gap-3 rounded-[var(--hl-radius-control)] px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                active
                  ? 'bg-hl-surface-muted text-hl-primary'
                  : 'text-hl-text-muted hover:bg-hl-surface-muted hover:text-hl-text',
              )}
            >
              <Icon
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className={cn(active ? 'text-hl-primary' : 'text-hl-text-soft')}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-hl-border px-2 py-3">
        <Link
          href={profileHref}
          className="flex items-center gap-2.5 rounded-[var(--hl-radius-control)] px-2 py-2 transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: avatarColors.bg }}
          >
            <span className="text-xs font-medium" style={{ color: avatarColors.fg }}>
              {initials}
            </span>
          </div>
          <span className="truncate text-sm font-medium text-hl-text-muted">{firstName || 'Perfil'}</span>
        </Link>
      </div>
    </aside>
  );
}
