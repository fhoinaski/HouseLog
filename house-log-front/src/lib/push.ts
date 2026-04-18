'use client';

import { pushApi } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let { publicKey } = await pushApi.publicKey();
  if (!publicKey) return { ok: false, reason: 'no_vapid_configured' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = json.endpoint ?? sub.endpoint;
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey('p256dh'));
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey('auth'));

  await pushApi.subscribe({ endpoint, keys: { p256dh, auth } });
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await pushApi.unsubscribe(sub.endpoint);
    } catch {
      // ignore
    }
    await sub.unsubscribe();
  }
}
