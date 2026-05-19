// NEXT_PUBLIC_API_URL deve ser configurada em .env.local (dev) ou nas variáveis
// de ambiente da plataforma de hosting (Vercel/produção). Em localhost, se a
// URL configurada apontar para workers.dev, preferimos a API local same-site
// para que o cookie HttpOnly de refresh funcione corretamente em fetch.
const DEFAULT_LOCAL_API_URL = 'http://localhost:8787/api/v1';

function prefersLocalApiFallback(apiUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost) return false;

  try {
    return new URL(apiUrl).hostname.endsWith('workers.dev');
  } catch {
    return false;
  }
}

export const BASE = (() => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) return DEFAULT_LOCAL_API_URL;
  return prefersLocalApiFallback(configured) ? DEFAULT_LOCAL_API_URL : configured;
})();

export const PUBLIC_BROWSER_PATH_PREFIXES = [
  '/login', '/register', '/invite', '/audit', '/share', '/handover', '/splash',
];

export const PUBLIC_API_PATH_PREFIXES = [
  '/auth/login', '/auth/register', '/auth/mfa', '/auth/refresh',
  '/invite', '/audit', '/share', '/public/handover',
];
