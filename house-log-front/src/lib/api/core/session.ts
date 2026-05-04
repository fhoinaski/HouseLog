import { PUBLIC_API_PATH_PREFIXES, PUBLIC_BROWSER_PATH_PREFIXES } from './config';
import { clearToken } from './storage';

function isPublicPath(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function handleUnauthorized(path: string) {
  clearToken();

  if (typeof window === 'undefined') return;
  if (isPublicPath(path, PUBLIC_API_PATH_PREFIXES)) return;

  const currentPath = window.location.pathname || '/dashboard';
  if (isPublicPath(currentPath, PUBLIC_BROWSER_PATH_PREFIXES)) return;

  const next = `${currentPath}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}
