import {
  Home,
  Building2,
  BarChart2,
  CalendarDays,
  Briefcase,
  ClipboardCheck,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchExact?: boolean;
}

export const NAV_CONFIG: Record<string, NavItem[]> = {
  owner: [
    { label: 'Início', href: '/dashboard', icon: Home, matchExact: true },
    { label: 'Imóveis', href: '/properties', icon: Building2 },
    { label: 'Agenda', href: '/schedule', icon: CalendarDays },
    { label: 'Financeiro', href: '/financial', icon: BarChart2 },
  ],
  manager: [
    { label: 'Início', href: '/dashboard', icon: Home, matchExact: true },
    { label: 'Imóveis', href: '/properties', icon: Building2 },
    { label: 'Financeiro', href: '/financial', icon: BarChart2 },
    { label: 'Agenda', href: '/schedule', icon: CalendarDays },
  ],
  provider: [
    { label: 'Início', href: '/provider/dashboard', icon: Home, matchExact: true },
    { label: 'Oportunidades', href: '/provider/opportunities', icon: Briefcase },
    { label: 'Minhas OS', href: '/provider/services', icon: ClipboardCheck },
    { label: 'Config.', href: '/provider/settings', icon: Settings2 },
  ],
};

export function getNavItems(role?: string | null): NavItem[] {
  if (!role) return NAV_CONFIG.owner;
  if (role === 'temp_provider') return NAV_CONFIG.provider;
  return NAV_CONFIG[role] ?? NAV_CONFIG.owner;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.matchExact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}
