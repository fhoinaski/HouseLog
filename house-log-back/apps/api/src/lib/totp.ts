// TOTP RFC 6238 (HOTP RFC 4226) — compatível com Google Authenticator / Authy / 1Password.
// 6 dígitos, período 30s, SHA-1. Tolera ±1 step de drift no verify.

const STEP_SECONDS = 30;
const DIGITS = 6;
const DRIFT_STEPS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return base32Encode(buf);
}

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

export function base32Decode(str: string): Uint8Array {
  const clean = str.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 char');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hotp(secret: Uint8Array, counter: bigint): Promise<string> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, counter, false);

  const key = await crypto.subtle.importKey(
    'raw',
    secret as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = sig[sig.length - 1]! & 0x0f;
  const bin =
    ((sig[offset]! & 0x7f) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff);
  const mod = 10 ** DIGITS;
  return String(bin % mod).padStart(DIGITS, '0');
}

export async function totpVerify(secretBase32: string, code: string): Promise<boolean> {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(secretBase32);
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let d = -DRIFT_STEPS; d <= DRIFT_STEPS; d++) {
    const expected = await hotp(secret, BigInt(now + d));
    if (timingSafeEqual(expected, clean)) return true;
  }
  return false;
}

export function otpauthUri(params: {
  accountName: string;
  issuer: string;
  secret: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Backup codes: 10 códigos de 8 dígitos alfanuméricos; armazenados como hash PBKDF2.
export function generateBackupCodes(n = 10): string[] {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    let s = '';
    for (const b of bytes) s += alpha[b % alpha.length];
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
}
