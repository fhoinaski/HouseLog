// NEXT_PUBLIC_API_URL deve ser configurada em .env.local (dev) ou nas variáveis
// de ambiente da plataforma de hosting (Vercel/produção). Nunca commitar URLs
// reais de Worker como fallback — exponha apenas o default de dev local.
export const BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'http://localhost:8787/api/v1';

export const PUBLIC_BROWSER_PATH_PREFIXES = [
  '/login', '/register', '/invite', '/audit', '/share', '/handover', '/splash',
];

export const PUBLIC_API_PATH_PREFIXES = [
  '/auth/login', '/auth/register', '/auth/mfa', '/auth/refresh',
  '/invite', '/audit', '/share', '/public/handover',
];
