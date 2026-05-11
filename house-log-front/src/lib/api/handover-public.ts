import { HandoverPackagePublicDtoSchema, type HandoverPackagePublic } from '@houselog/contracts';
import { z } from 'zod';

import { normalizeApiMediaUrls } from '@/lib/api/_core';

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8787';
const PublicHandoverResponseSchema = z.object({
  package: HandoverPackagePublicDtoSchema,
});

export type PublicHandoverErrorCode =
  | 'NOT_FOUND'
  | 'LINK_EXPIRED'
  | 'PACKAGE_REVOKED'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN';

export class PublicHandoverError extends Error {
  status: number;
  code: PublicHandoverErrorCode;

  constructor(message: string, status: number, code: PublicHandoverErrorCode) {
    super(message);
    this.name = 'PublicHandoverError';
    this.status = status;
    this.code = code;
  }
}

type ApiErrorBody = {
  error?: string | { message?: string; code?: string };
  code?: string;
};

function normalizePublicErrorCode(value: string | undefined, status: number): PublicHandoverErrorCode {
  if (value === 'LINK_EXPIRED' || value === 'PACKAGE_REVOKED' || value === 'INTERNAL_ERROR') return value;
  if (value === 'NOT_FOUND') return 'NOT_FOUND';
  if (status === 404) return 'NOT_FOUND';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'UNKNOWN';
}

async function publicRequest<T>(path: string): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch((): ApiErrorBody => ({ error: 'Link invalido' }));
    const apiError = body.error;
    const rawMessage = typeof apiError === 'object' ? apiError.message : apiError;
    const rawCode = typeof apiError === 'object' ? apiError.code : body.code;
    const code = normalizePublicErrorCode(rawCode, res.status);
    throw new PublicHandoverError(rawMessage ?? 'Nao foi possivel abrir este pacote.', res.status, code);
  }

  return normalizeApiMediaUrls(await res.json() as T);
}

export const publicHandoverApi = {
  getByToken: (token: string) =>
    publicRequest<{ package: HandoverPackagePublic }>(`/api/v1/public/handover/${encodeURIComponent(token)}`).then((data) =>
      PublicHandoverResponseSchema.parse(data)
    ),
};
