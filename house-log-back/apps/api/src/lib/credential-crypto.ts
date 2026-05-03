// AES-GCM credential encryption for Cloudflare Workers (Web Crypto API).
// Storage format: v1:<base64url(iv)>:<base64url(ciphertext)>

const ENC_VERSION = 'v1';
const IV_BYTES = 12; // 96-bit IV — AES-GCM standard recommendation

export function isEncrypted(value: string): boolean {
  return value.startsWith('v1:');
}

async function deriveKey(rawKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(rawKey),
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('houselog-cred-v1'),
      info: enc.encode('credential-encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)!;
  return bytes;
}

export async function encryptSecret(plaintext: string, rawKey: string): Promise<string> {
  const key = await deriveKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${ENC_VERSION}:${toBase64url(iv.buffer as ArrayBuffer)}:${toBase64url(ct)}`;
}

export async function decryptSecret(ciphertext: string, rawKey: string): Promise<string> {
  const parts = ciphertext.split(':');
  if (parts.length !== 3 || parts[0] !== ENC_VERSION) {
    throw new Error('Invalid ciphertext format');
  }
  const [, ivB64, ctB64] = parts;
  const key = await deriveKey(rawKey);
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64url(ivB64!) },
    key,
    fromBase64url(ctB64!)
  );
  return new TextDecoder().decode(dec);
}

// Returns the AES key material.
// Prefers a dedicated env var; falls back to JWT_SECRET with a domain suffix
// (documented as less secure — set CREDENTIALS_ENCRYPTION_KEY in production).
export function getCredentialKey(env: {
  CREDENTIALS_ENCRYPTION_KEY?: string;
  JWT_SECRET: string;
}): string {
  if (env.CREDENTIALS_ENCRYPTION_KEY) return env.CREDENTIALS_ENCRYPTION_KEY;
  return env.JWT_SECRET + '::houselog-cred-v1';
}
