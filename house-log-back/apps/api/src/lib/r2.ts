// R2 presigned URL helpers
// Cloudflare R2 supports presigned URLs via the S3-compatible API

export type UploadTarget = {
  uploadUrl: string;   // PUT to this URL
  fileUrl: string;     // Public URL after upload
  key: string;
};

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
]);

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export function validateUpload(
  mimeType: string,
  fileSize: number
): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: `Tipo de arquivo não permitido: ${mimeType}` };
  }
  if (fileSize > MAX_SIZE) {
    return { ok: false, error: 'Arquivo excede o limite de 50MB' };
  }
  return { ok: true };
}

export function buildR2Key(opts: {
  propertyId: string;
  category: 'photos' | 'videos' | 'documents' | 'avatars' | 'inventory' | 'invoices';
  filename: string;
}): string {
  const ext = opts.filename.split('.').pop() ?? 'bin';
  const ts = Date.now();
  return `${opts.propertyId}/${opts.category}/${ts}.${ext}`;
}

// For direct Worker uploads (no presigned URL needed when using Workers)
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<string> {
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });
  return key;
}

export async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

// Build a public URL for a stored object
export function getPublicUrl(key: string, baseUrl: string): string {
  const trimmedKey = key.trim();
  if (/^https?:\/\//i.test(trimmedKey)) return trimmedKey;

  const publicBaseUrl = baseUrl.trim().replace(/\/$/, '');
  if (!publicBaseUrl) {
    throw new Error('R2_PUBLIC_URL is required to build public file URLs');
  }

  return `${publicBaseUrl}/${trimmedKey.replace(/^\/+/, '')}`;
}

export function extractR2KeyFromPublicUrl(fileUrl: string, publicBaseUrl?: string): string {
  const value = fileUrl.trim();
  const base = publicBaseUrl?.trim().replace(/\/$/, '');

  if (!value) return value;

  if (base && value.startsWith(`${base}/`)) {
    return decodeURIComponent(value.slice(base.length + 1));
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/r2/')) {
      return decodeURIComponent(parsed.pathname.slice('/r2/'.length));
    }
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return value.replace(/^\/+/, '');
  }
}
