import { BASE, PUBLIC_API_PATH_PREFIXES, PUBLIC_BROWSER_PATH_PREFIXES } from './config';
import { setToken, clearToken } from './storage';

function isPublicPath(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Returns true if a 401 response on this API path warrants a silent refresh attempt. */
export function shouldAttemptRefresh(apiPath: string): boolean {
  return !isPublicPath(apiPath, PUBLIC_API_PATH_PREFIXES);
}

export function handleUnauthorized(path: string): void {
  clearToken();

  if (typeof window === 'undefined') return;
  if (isPublicPath(path, PUBLIC_API_PATH_PREFIXES)) return;

  const currentPath = window.location.pathname || '/dashboard';
  if (isPublicPath(currentPath, PUBLIC_BROWSER_PATH_PREFIXES)) return;

  const next = `${currentPath}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}

// A single in-flight promise shared across all concurrent callers —
// prevents multiple simultaneous /auth/refresh requests during token expiry.
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Calls POST /auth/refresh using the HttpOnly cookie and stores the new access token
 * in module memory. Concurrent callers all share the same in-flight request.
 *
 * Returns the new access token, or null if the session could not be renewed.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { access_token?: string };
      const token = body.access_token ?? null;
      if (token) setToken(token);
      return token;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}
