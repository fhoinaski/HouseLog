export const BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'https://houselog-api-dev.sukinodoncai.workers.dev/api/v1';

export const PUBLIC_BROWSER_PATH_PREFIXES = [
  '/login', '/register', '/invite', '/audit', '/share', '/splash',
];

export const PUBLIC_API_PATH_PREFIXES = [
  '/auth/login', '/auth/register', '/auth/mfa', '/auth/refresh',
  '/invite', '/audit', '/share',
];
