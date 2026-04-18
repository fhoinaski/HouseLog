// Web Push implementação minimalista para Cloudflare Workers.
// Envia notificações para endpoints FCM/Mozilla usando VAPID + aesgcm128/aes128gcm.
// Usamos "aes128gcm" (RFC 8291) — padrão moderno; FCM e Mozilla suportam.
//
// Limitações: payload máximo ~4KB após criptografia. Suficiente para título+corpo+URL.

import type { PushPayload } from './types';

type VapidKeys = { publicKey: string; privateKey: string; subject: string };

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// VAPID JWT (ES256) para Authorization header
async function signVapidJwt(keys: VapidKeys, audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: keys.subject };
  const encoded =
    b64urlEncode(new TextEncoder().encode(JSON.stringify(header))) +
    '.' +
    b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));

  const privBytes = b64urlDecode(keys.privateKey);
  const pubBytes = b64urlDecode(keys.publicKey);
  // publicKey formato uncompressed 0x04|x|y → x,y concat 32 bytes each
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: b64urlEncode(privBytes),
    x: b64urlEncode(pubBytes.slice(1, 33)),
    y: b64urlEncode(pubBytes.slice(33, 65)),
    ext: true,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(encoded)
  );
  return `${encoded}.${b64urlEncode(sig)}`;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const keyIkm = await crypto.subtle.importKey(
    'raw',
    ikm as unknown as ArrayBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      info: info as unknown as ArrayBuffer,
    },
    keyIkm,
    length * 8
  );
  return new Uint8Array(bits);
}

// Encripta payload no formato aes128gcm (RFC 8188).
async function encryptPayload(
  payload: Uint8Array,
  subP256dh: string,
  subAuth: string
): Promise<{ body: Uint8Array; contentEncoding: 'aes128gcm' }> {
  const clientPub = b64urlDecode(subP256dh);
  const auth = b64urlDecode(subAuth);

  // Gera ECDH efêmero
  const ephKeys = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair;
  const ephPubRaw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', ephKeys.publicKey)) as ArrayBuffer
  );

  // Importa a pub key do cliente
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPub as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  // Workers types são restritivas aqui; em runtime aceita { name, public }.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deriveParams: any = { name: 'ECDH', public: clientKey };
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(deriveParams, ephKeys.privateKey, 256)
  );

  // key_info per RFC 8291
  const keyInfo = new TextEncoder().encode('WebPush: info\0');
  const keyInfoFull = new Uint8Array(keyInfo.length + clientPub.length + ephPubRaw.length);
  keyInfoFull.set(keyInfo, 0);
  keyInfoFull.set(clientPub, keyInfo.length);
  keyInfoFull.set(ephPubRaw, keyInfo.length + clientPub.length);

  const ikm = await hkdf(auth, shared, keyInfoFull, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Plaintext = payload || 0x02 (delimiter "last record")
  const plain = new Uint8Array(payload.length + 1);
  plain.set(payload, 0);
  plain[payload.length] = 0x02;

  const aesKey = await crypto.subtle.importKey('raw', cek as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as unknown as ArrayBuffer }, aesKey, plain as unknown as ArrayBuffer)
  );

  // Header bloc: salt(16) | rs(4) | idlen(1) | keyid(eph pub = 65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + ephPubRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = ephPubRaw.length;
  header.set(ephPubRaw, 21);

  const body = new Uint8Array(header.length + ct.length);
  body.set(header, 0);
  body.set(ct, header.length);

  return { body, contentEncoding: 'aes128gcm' };
}

export type PushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Envia uma push. Retorna status HTTP do servidor de push.
// status 404/410 → assinatura expirada (o caller deve apagar do DB).
export async function sendWebPush(
  sub: PushSubscription,
  payload: PushPayload,
  vapid: VapidKeys
): Promise<{ status: number; statusText: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(vapid, audience);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const { body, contentEncoding } = await encryptPayload(plain, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': contentEncoding,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.length),
      TTL: '86400',
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body,
  });
  return { status: res.status, statusText: res.statusText };
}

export function hasVapid(env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }): env is Required<typeof env> {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

// Envia para todos os endpoints do usuário. Apaga endpoints mortos (404/410).
export async function pushToUser(
  db: D1Database,
  env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string },
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!hasVapid(env)) return 0;
  const subs = await db
    .prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`)
    .bind(userId)
    .all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

  let sent = 0;
  for (const row of subs.results ?? []) {
    try {
      const r = await sendWebPush(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        payload,
        {
          publicKey: env.VAPID_PUBLIC_KEY!,
          privateKey: env.VAPID_PRIVATE_KEY!,
          subject: env.VAPID_SUBJECT!,
        }
      );
      if (r.status === 404 || r.status === 410) {
        await db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(row.id).run();
      } else if (r.status >= 200 && r.status < 300) {
        sent++;
        await db
          .prepare(`UPDATE push_subscriptions SET last_used_at = datetime('now') WHERE id = ?`)
          .bind(row.id)
          .run();
      }
    } catch {
      // ignore individual failures
    }
  }
  return sent;
}
