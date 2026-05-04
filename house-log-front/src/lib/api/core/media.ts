import { BASE } from './config';

const R2_KEY_PATTERN = /^\/?.*(photos|videos|documents|avatars|inventory|invoices)\//;
const MEDIA_FIELD_NAMES = new Set([
  'afterImageUrl',
  'after_photos',
  'attachments',
  'avatar_url',
  'beforeImageUrl',
  'before_photos',
  'cover_url',
  'fileUrl',
  'file_url',
  'invoice_url',
  'mediaUrls',
  'media_urls',
  'photo_url',
  'receipt_url',
  'url',
  'video_url',
  'audio_url',
]);

export function normalizeMediaUrl(value: string): string {
  const mediaUrl = value.trim();
  if (!mediaUrl || /^(blob|data):/i.test(mediaUrl)) return mediaUrl;

  try {
    const parsed = new URL(mediaUrl);
    const isLocalR2Url =
      ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/r2/');

    if (isLocalR2Url) {
      return `${BASE}/media/${parsed.pathname.slice('/r2/'.length)}${parsed.search}`;
    }

    // Proxy Cloudflare R2 public bucket URLs through the backend media endpoint.
    // This covers data stored before the backend was fixed to store raw keys.
    if (parsed.hostname.endsWith('.r2.dev') && R2_KEY_PATTERN.test(parsed.pathname)) {
      return `${BASE}/media/${parsed.pathname.replace(/^\//, '')}${parsed.search}`;
    }

    return mediaUrl;
  } catch {
    // Relative R2 keys are normalized below.
  }

  if (mediaUrl.startsWith('/r2/')) {
    return `${BASE}/media/${mediaUrl.slice('/r2/'.length)}`;
  }

  if (R2_KEY_PATTERN.test(mediaUrl)) {
    return `${BASE}/media/${mediaUrl.replace(/^\//, '')}`;
  }

  return mediaUrl;
}

function normalizeMediaField(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return JSON.stringify(
            parsed.map((item) => (typeof item === 'string' ? normalizeMediaUrl(item) : item))
          );
        }
      } catch {
        // Fall through and treat it as a plain string.
      }
    }

    return normalizeMediaUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? normalizeMediaUrl(item) : normalizeApiMediaUrls(item)));
  }
  return normalizeApiMediaUrls(value);
}

export function normalizeApiMediaUrls<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeApiMediaUrls(item)) as T;
  }

  const input = payload as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = MEDIA_FIELD_NAMES.has(key) ? normalizeMediaField(value) : normalizeApiMediaUrls(value);
  }

  return output as T;
}
