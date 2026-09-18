const alg = { name: 'AES-GCM', length: 256 };
const ivLength = 12;
const salt = 'auth-store';
const v0Prefix = 'v0:';
const v1Prefix = 'v1:';

function getSecret(): string {
  const viteSecret =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.VITE_AUTH_SECRET
      : '';
  const nodeSecret =
    typeof process !== 'undefined' && (process as any).env
      ? (process as any).env.VITE_AUTH_SECRET
      : '';
  const envSecret = viteSecret || nodeSecret;
  return envSecret || 'subaru-auth-dev';
}

function hasSubtleCrypto(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.importKey === 'function' &&
    typeof globalThis.crypto.subtle.deriveKey === 'function' &&
    typeof globalThis.crypto.subtle.encrypt === 'function' &&
    typeof globalThis.crypto.subtle.decrypt === 'function'
  );
}

function utf8ToBase64(s: string): string {
  const enc = new TextEncoder();
  return toBase64(enc.encode(s));
}

function base64ToUtf8(b64: string): string {
  const dec = new TextDecoder();
  return dec.decode(fromBase64(b64));
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    alg,
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(arr: Uint8Array): string {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

export async function encryptString(plain: string): Promise<string> {
  if (!hasSubtleCrypto()) {
    return `${v0Prefix}${utf8ToBase64(plain)}`;
  }
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));
  const key = await deriveKey(getSecret());
  const enc = new TextEncoder();
  const data = enc.encode(plain);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const out = new Uint8Array(iv.length + (cipher as ArrayBuffer).byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher as ArrayBuffer), iv.length);
  return `${v1Prefix}${toBase64(out)}`;
}

export async function decryptString(payload: string): Promise<string> {
  if (payload.startsWith(v0Prefix)) {
    return base64ToUtf8(payload.slice(v0Prefix.length));
  }

  const raw = payload.startsWith(v1Prefix) ? payload.slice(v1Prefix.length) : payload;
  if (!hasSubtleCrypto()) {
    if (payload.startsWith(v1Prefix)) {
      throw new Error('WebCrypto unavailable');
    }
    return base64ToUtf8(raw);
  }

  const all = fromBase64(raw);
  const iv = all.slice(0, ivLength);
  const cipher = all.slice(ivLength);
  const key = await deriveKey(getSecret());
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  const dec = new TextDecoder();
  return dec.decode(plain);
}
