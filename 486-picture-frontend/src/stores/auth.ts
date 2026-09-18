import { create } from 'zustand';
import { encryptString, decryptString } from '../utils/crypto';
import type { AuthState, UserInfo } from '../types/auth';

const PERSIST_KEY = 'auth_store';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CSRF_COOKIE = 'csrf_token';

type AuthStore = AuthState & {
  csrfHeader: Record<string, string>;
  init: () => Promise<void>;
  login: (user: UserInfo) => Promise<void>;
  logout: () => Promise<void>;
  refreshPersistence: () => Promise<void>;
};

function now(): number {
  return Date.now();
}

function setCookie(name: string, value: string, days: number): void {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${d.toUTCString()}`;
  const sameSite = 'SameSite=Strict';
  const secure = location.protocol === 'https:' ? 'Secure' : '';
  document.cookie = `${name}=${value};${expires};Path=/;${sameSite};${secure}`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;Path=/;SameSite=Strict`;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

async function serialize(state: AuthState): Promise<string> {
  const payload = { data: state, ts: now(), exp: now() + TTL_MS };
  const json = JSON.stringify(payload);
  return encryptString(json);
}

async function deserialize(value: string): Promise<AuthState> {
  try {
    const json = await decryptString(value);
    const payload = JSON.parse(json) as { data: AuthState; ts: number; exp: number };
    if (payload.exp && now() > payload.exp) return defaultState();
    return payload.data;
  } catch {
    return defaultState();
  }
}

function defaultState(): AuthState {
  return { isLoggedIn: false, userInfo: null, csrfToken: null, expiresAt: null };
}

function genToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...defaultState(),
  csrfHeader: {},
  async init(): Promise<void> {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) {
      const token = genToken();
      const expiresAt = now() + TTL_MS;
      set(() => ({
        isLoggedIn: false,
        userInfo: null,
        csrfToken: token,
        expiresAt,
        csrfHeader: { 'X-CSRF-Token': token },
      }));
      setCookie(CSRF_COOKIE, token, 30);
      return;
    }
    const restored = await deserialize(raw);
    let csrfToken = restored.csrfToken;
    if (!csrfToken) {
      const token = readCookie(CSRF_COOKIE) || genToken();
      csrfToken = token;
      setCookie(CSRF_COOKIE, token, 30);
    } else {
      setCookie(CSRF_COOKIE, csrfToken, 30);
    }
    let expiresAt = restored.expiresAt;
    if (!expiresAt) {
      expiresAt = now() + TTL_MS;
    }
    if (expiresAt && now() > expiresAt) {
      await get().logout();
      return;
    }
    set(() => ({
      isLoggedIn: restored.isLoggedIn,
      userInfo: restored.userInfo,
      csrfToken,
      expiresAt,
      csrfHeader: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    }));
  },
  async login(user: UserInfo): Promise<void> {
    let csrfToken = get().csrfToken;
    if (!csrfToken) {
      csrfToken = genToken();
    }
    const expiresAt = now() + TTL_MS;
    const nextState: AuthState = {
      isLoggedIn: true,
      userInfo: user,
      csrfToken,
      expiresAt,
    };
    set(() => ({
      ...nextState,
      csrfHeader: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    }));
    setCookie(CSRF_COOKIE, csrfToken, 30);
    const value = await serialize(nextState);
    localStorage.setItem(PERSIST_KEY, value);
  },
  async logout(): Promise<void> {
    set(() => ({
      ...defaultState(),
      csrfHeader: {},
    }));
    localStorage.removeItem(PERSIST_KEY);
    deleteCookie(CSRF_COOKIE);
  },
  async refreshPersistence(): Promise<void> {
    const current = get();
    const expiresAt = now() + TTL_MS;
    const nextState: AuthState = {
      isLoggedIn: current.isLoggedIn,
      userInfo: current.userInfo,
      csrfToken: current.csrfToken,
      expiresAt,
    };
    set(() => ({
      ...nextState,
      csrfHeader: nextState.csrfToken ? { 'X-CSRF-Token': nextState.csrfToken } : {},
    }));
    const value = await serialize(nextState);
    localStorage.setItem(PERSIST_KEY, value);
    if (nextState.csrfToken) setCookie(CSRF_COOKIE, nextState.csrfToken, 30);
  },
}));
