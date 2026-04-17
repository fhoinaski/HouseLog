import type { Role } from './types';

export type JwtPayload = {
  sub: string;   // user id
  email: string;
  role: Role;
  iat: number;
  exp: number;
};

const ALG = 'HS256';

function base64url(data: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeBase64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 7 // 7 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const header = encodeBase64url(JSON.stringify({ alg: ALG, typ: 'JWT' }));
  const body = encodeBase64url(JSON.stringify(fullPayload));
  const message = `${header}.${body}`;

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));

  return `${message}.${base64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [header, body, signature] = parts as [string, string, string];
  const message = `${header}.${body}`;

  const key = await getKey(secret);
  const sigBytes = Uint8Array.from(decodeBase64url(signature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(message));

  if (!valid) throw new Error('Invalid JWT signature');

  const payload: JwtPayload = JSON.parse(decodeBase64url(body));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired');

  return payload;
}

const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltBytes = Uint8Array.from(
    saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return toHex(derived);
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const saltHex =
    salt ??
    toHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  const hash = await deriveKey(password, saltHex);
  return `pbkdf2:${saltHex}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length === 3 && parts[0] === 'pbkdf2') {
    const [, saltHex, expectedHash] = parts as [string, string, string];
    const derived = await deriveKey(password, saltHex);
    return derived === expectedHash;
  }
  // Legacy SHA-256 (plain base64url) — one-way migration on next login handled in routes
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return base64url(hash) === stored;
}
