import { BASE } from './config';
import { getToken } from './storage';
import { handleUnauthorized } from './session';
import { normalizeApiMediaUrls } from './media';

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  403: 'Você não tem permissão para executar esta ação.',
  404: 'Não encontramos este documento ou ele não pertence a este imóvel.',
  409: 'Esta ação não pode ser concluída porque já existe um estado ativo ou conflito.',
  422: 'Alguns dados estão inválidos. Revise as informações e tente novamente.',
  500: 'Não foi possível concluir a ação agora. Tente novamente em instantes.',
};

type ApiErrorLike = {
  message?: string;
  status?: number;
};

export function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries as [string, string][]) : '';
}

export function getApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as ApiErrorLike;
    if (typeof maybeError.status === 'number' && HTTP_ERROR_MESSAGES[maybeError.status]) {
      return HTTP_ERROR_MESSAGES[maybeError.status];
    }
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }
  }

  return 'Não foi possível concluir a ação agora. Tente novamente em instantes.';
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

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido', code: 'UNKNOWN' }));
    const apiError = (body as { error?: string | { message?: string; code?: string; details?: unknown }; code?: string; details?: unknown }).error;
    const rawMessage = typeof apiError === 'object' ? apiError.message : apiError;
    const message = HTTP_ERROR_MESSAGES[res.status] ?? rawMessage;
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
