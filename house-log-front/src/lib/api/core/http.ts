import { BASE } from './config';
import { getToken } from './storage';
import { handleUnauthorized } from './session';
import { normalizeApiMediaUrls } from './media';

export function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries as [string, string][]) : '';
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido', code: 'UNKNOWN' }));
    const apiError = (body as { error?: string | { message?: string; code?: string; details?: unknown }; code?: string; details?: unknown }).error;
    const message = typeof apiError === 'object' ? apiError.message : apiError;
    const code = typeof apiError === 'object' ? apiError.code : (body as { code?: string }).code;
    const details = typeof apiError === 'object' ? apiError.details : (body as { details?: unknown }).details;
    const error = new Error(message ?? 'Request failed') as Error & {
      code: string;
      status: number;
      details?: unknown;
    };
    error.code = code ?? 'UNKNOWN';
    error.status = res.status;
    error.details = details;
    if (res.status === 401) handleUnauthorized(path);
    throw error;
  }

  const data = await res.json() as T;
  return normalizeApiMediaUrls(data);
}

// Generic fetcher for useSWRInfinite (receives relative path, injects auth)
export function apiFetcher<T>(path: string): Promise<T> {
  return request<T>(path);
}
