// Pipeline de thumbnails via queue.
//
// Estratégia:
//   1) Lê o objeto original do R2.
//   2) Usa Cloudflare Image Resizing (via fetch + cf.image) para redimensionar.
//      Para funcionar, o bucket precisa estar acessível por uma URL pública
//      (R2_PUBLIC_URL). Se não houver URL pública ou falhar o resize, copia o
//      original como thumb (fallback não-otimizado mas não quebra o fluxo).
//   3) Grava as variantes de volta no R2 e registra em image_variants.
//
// Tamanhos gerados: thumb (320px) e medium (960px), ambos em WebP.

import type { Bindings } from './types';
import { log } from './logger';
import { getDb } from '../db/client';
import { imageVariants } from '../db/schema';

type Variant = { key: string; width: number; bytes: Uint8Array };

const VARIANTS: Array<{ suffix: 'thumb' | 'medium'; width: number }> = [
  { suffix: 'thumb', width: 320 },
  { suffix: 'medium', width: 960 },
];

function deriveVariantKey(origKey: string, suffix: string): string {
  // foo/bar/baz.jpg → foo/bar/baz.thumb.webp
  const dot = origKey.lastIndexOf('.');
  const base = dot > 0 ? origKey.slice(0, dot) : origKey;
  return `${base}.${suffix}.webp`;
}

async function resizeViaCloudflare(
  env: Bindings,
  origKey: string,
  width: number
): Promise<Uint8Array | null> {
  if (!env.R2_PUBLIC_URL) return null;
  try {
    const url = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${origKey}`;
    const res = await fetch(url, {
      // cf.image só funciona em zonas com Image Resizing habilitado
      cf: { image: { width, format: 'webp', quality: 82, fit: 'scale-down' } },
    } as RequestInit);
    if (!res.ok) {
      log.warn('image_resize_upstream_failed', { origKey, width, status: res.status });
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    log.warn('image_resize_exception', { origKey, width, error: String(e) });
    return null;
  }
}

export async function generateThumbnails(
  env: Bindings,
  origKey: string
): Promise<{ thumb_key: string | null; medium_key: string | null }> {
  const original = await env.STORAGE.get(origKey);
  if (!original) {
    log.warn('image_resize_origin_missing', { origKey });
    return { thumb_key: null, medium_key: null };
  }

  const variants: Variant[] = [];
  for (const v of VARIANTS) {
    const bytes = await resizeViaCloudflare(env, origKey, v.width);
    if (bytes) {
      variants.push({ key: deriveVariantKey(origKey, v.suffix), width: v.width, bytes });
    }
  }

  // Sem resize (CF Images não habilitado): usa o original como fallback apenas
  // para o "thumb", para não inflar o bucket.
  if (variants.length === 0) {
    const origBytes = new Uint8Array(await original.arrayBuffer());
    variants.push({
      key: deriveVariantKey(origKey, 'thumb'),
      width: 0,
      bytes: origBytes,
    });
  }

  for (const v of variants) {
    await env.STORAGE.put(v.key, v.bytes as unknown as ArrayBuffer, {
      httpMetadata: { contentType: 'image/webp' },
    });
  }

  const thumbKey = variants.find((v) => v.key.includes('.thumb.'))?.key ?? null;
  const mediumKey = variants.find((v) => v.key.includes('.medium.'))?.key ?? null;

  const db = getDb(env.DB);
  await db
    .insert(imageVariants)
    .values({
      r2Key: origKey,
      thumbKey,
      mediumKey,
      processedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: imageVariants.r2Key,
      set: {
        thumbKey,
        mediumKey,
        processedAt: new Date().toISOString(),
      },
    });

  log.info('image_variants_ready', { origKey, thumbKey, mediumKey });
  return { thumb_key: thumbKey, medium_key: mediumKey };
}
