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
const DANGEROUS_EXTENSIONS = new Set([
  'bat',
  'cmd',
  'com',
  'exe',
  'html',
  'hta',
  'jar',
  'js',
  'msi',
  'php',
  'ps1',
  'scr',
  'sh',
  'svg',
  'vbs',
]);

const EXTENSIONS_BY_MIME = new Map<string, Set<string>>([
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/webp', new Set(['webp'])],
  ['video/mp4', new Set(['mp4'])],
  ['application/pdf', new Set(['pdf'])],
]);

function getFileExtension(filename?: string): string {
  const cleanName = filename?.split(/[\\/]/).pop() ?? '';
  const ext = cleanName.includes('.') ? cleanName.split('.').pop() : '';
  return (ext ?? '').trim().toLowerCase();
}

export function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'video/mp4';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return 'audio/wav';
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'audio/ogg';
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return 'audio/mpeg';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'audio/webm';
  }
  return null;
}

function concatChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function stripJpegExif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const chunks: Uint8Array[] = [bytes.slice(0, 2)];
  let totalLength = 2;
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      const tail = bytes.slice(offset);
      chunks.push(tail);
      totalLength += tail.length;
      return concatChunks(chunks, totalLength);
    }

    const segmentLength = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return bytes;

    const isExifSegment = marker === 0xe1;
    if (!isExifSegment) {
      const segment = bytes.slice(offset, offset + 2 + segmentLength);
      chunks.push(segment);
      totalLength += segment.length;
    }
    offset += 2 + segmentLength;
  }

  const tail = bytes.slice(offset);
  chunks.push(tail);
  totalLength += tail.length;
  return concatChunks(chunks, totalLength);
}

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

export function validatePrivateUpload(
  mimeType: string,
  fileSize: number,
  filename: string
): { ok: true } | { ok: false; error: string } {
  const base = validateUpload(mimeType, fileSize);
  if (!base.ok) return base;

  const extension = getFileExtension(filename);
  if (!extension) {
    return { ok: false, error: 'Arquivo sem extensao valida' };
  }
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Extensao de arquivo nao permitida' };
  }

  const expectedExtensions = EXTENSIONS_BY_MIME.get(mimeType);
  if (expectedExtensions && !expectedExtensions.has(extension)) {
    return { ok: false, error: 'Extensao nao corresponde ao tipo do arquivo' };
  }

  return { ok: true };
}

export async function preparePrivateUpload(
  file: File
): Promise<{ ok: true; buffer: ArrayBuffer; mimeType: string; size: number } | { ok: false; error: string }> {
  const metadataValidation = validatePrivateUpload(file.type, file.size, file.name);
  if (!metadataValidation.ok) return metadataValidation;

  const originalBuffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(originalBuffer);
  const detectedMimeType = detectMimeType(originalBytes);

  if (!detectedMimeType || detectedMimeType !== file.type) {
    return { ok: false, error: 'Conteudo do arquivo nao corresponde ao tipo declarado' };
  }

  if (detectedMimeType === 'image/jpeg') {
    const sanitizedBytes = stripJpegExif(originalBytes);
    const sanitizedBuffer = new ArrayBuffer(sanitizedBytes.byteLength);
    new Uint8Array(sanitizedBuffer).set(sanitizedBytes);
    return {
      ok: true,
      buffer: sanitizedBuffer,
      mimeType: detectedMimeType,
      size: sanitizedBytes.byteLength,
    };
  }

  return { ok: true, buffer: originalBuffer, mimeType: detectedMimeType, size: originalBytes.byteLength };
}

export function buildR2Key(opts: {
  propertyId: string;
  category: 'photos' | 'videos' | 'documents' | 'avatars' | 'inventory' | 'invoices';
  filename: string;
}): string {
  const ext = getFileExtension(opts.filename) || 'bin';
  const randomId = crypto.randomUUID().replace(/-/g, '');
  return `${opts.propertyId}/${opts.category}/${randomId}.${ext}`;
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
