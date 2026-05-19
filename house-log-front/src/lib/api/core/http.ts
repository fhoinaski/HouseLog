import { BASE } from './config';
import { getToken } from './storage';
import { handleUnauthorized, shouldAttemptRefresh, refreshAccessToken } from './session';
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

type RawBody = {
  error?: string | { message?: string; code?: string; details?: unknown };
  code?: string;
  details?: unknown;
};

function buildApiError(body: RawBody, status: number): Error & { code: string; status: number; details?: unknown } {
  const apiError = body.error;
  const rawMessage = typeof apiError === 'object' ? apiError?.message : apiError;
  const message = HTTP_ERROR_MESSAGES[status] ?? rawMessage;
  const code = typeof apiError === 'object' ? apiError?.code : body.code;
  const details = typeof apiError === 'object' ? apiError?.details : body.details;
  const error = new Error(message ?? 'Request failed') as Error & {
    code: string;
    status: number;
    details?: unknown;
  };
  error.code = code ?? 'UNKNOWN';
  error.status = status;
  error.details = details;
  return error;
}

async function parseErrorBody(res: Response): Promise<RawBody> {
  return res.json().catch(() => ({ error: 'Erro desconhecido', code: 'UNKNOWN' })) as Promise<RawBody>;
}

export { clearRefreshCooldown } from './session';

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

  let res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });

  // Silent token refresh on first 401 — non-public endpoints only.
  // Concurrent callers share the same in-flight refresh request (deduplication in session.ts).
  if (res.status === 401 && shouldAttemptRefresh(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: retryHeaders,
        credentials: 'include',
      });
    }
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    const error = buildApiError(body, res.status);
    if (res.status === 401) handleUnauthorized(path);
    throw error;
  }

  const data = (await res.json()) as T;
  return normalizeApiMediaUrls(data);
}

// Generic fetcher for useSWRInfinite (receives relative path, injects auth)
export function apiFetcher<T>(path: string): Promise<T> {
  return request<T>(path);
}
