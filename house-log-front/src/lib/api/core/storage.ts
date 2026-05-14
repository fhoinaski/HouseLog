// Access token lives only in module memory — never written to localStorage or sessionStorage.
// This prevents XSS from silently exfiltrating long-lived tokens.

let _accessToken: string | null = null;

export function getToken(): string | null {
  return _accessToken;
}

export function setToken(token: string): void {
  _accessToken = token;
}

export function clearToken(): void {
  _accessToken = null;
}

/**
 * Removes legacy localStorage keys left by older app versions.
 * Must be called once on app bootstrap (AuthProvider mount) to complete the migration.
 */
export function clearLegacyAuthStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('hl_token');   // access token — now in-memory only
  localStorage.removeItem('hl_refresh'); // refresh token — was stored in even older versions
}
