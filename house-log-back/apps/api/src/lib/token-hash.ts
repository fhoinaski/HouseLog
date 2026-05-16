export const PUBLIC_TOKEN_PLACEHOLDER_PREFIX = 'hash-only:';

export async function sha256TokenHash(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function publicTokenPlaceholder(id: string): string {
  return `${PUBLIC_TOKEN_PLACEHOLDER_PREFIX}${id}`;
}

export function isPublicTokenPlaceholder(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith(PUBLIC_TOKEN_PLACEHOLDER_PREFIX);
}

export function shouldRedactPublicTokenPlaintext(input: {
  token: string | null | undefined;
  tokenHash: string | null | undefined;
}): boolean {
  return Boolean(input.tokenHash) && Boolean(input.token) && !isPublicTokenPlaceholder(input.token);
}
