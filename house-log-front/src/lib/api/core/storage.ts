const TOKEN_KEY = 'hl_token';
const USER_KEY = 'hl_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Remove legacy key from older sessions (migration cleanup)
  localStorage.removeItem('hl_refresh');
}
