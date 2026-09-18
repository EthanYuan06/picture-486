import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './auth';

function getItem(key: string): string | null {
  return window.localStorage.getItem(key);
}

describe('authStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;Path=/;SameSite=Strict`;
    });
  });

  it('initializes with csrf token and default state', async () => {
    const store = useAuthStore.getState();
    await store.init();
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.userInfo).toBeNull();
    expect(state.csrfToken).toBeTruthy();
    expect(document.cookie.includes('csrf_token=')).toBe(true);
  });

  it('login persists encrypted data and sets expiry', async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.login({ id: '1', username: 'alice', email: 'a@b.com' });
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    const raw = getItem('auth_store')!;
    expect(raw).toBeTruthy();
    expect(raw.includes('alice')).toBe(false);
    expect(state.expiresAt).toBeGreaterThan(Date.now());
  });

  it('restores within TTL and includes csrf header', async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.login({ id: '2', username: 'bob' });
    const restored = useAuthStore.getState();
    await restored.init();
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.csrfHeader['X-CSRF-Token']).toBeTruthy();
  });

  it('logout clears state, storage and cookie', async () => {
    const store = useAuthStore.getState();
    await store.init();
    await store.login({ id: '3', username: 'carl' });
    await store.logout();
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(window.localStorage.getItem('auth_store')).toBeNull();
    expect(document.cookie.includes('csrf_token=')).toBe(false);
  });

  it('expires after 30 days and auto-clears on init', async () => {
    vi.useFakeTimers();
    const start = new Date();
    vi.setSystemTime(start);
    const store = useAuthStore.getState();
    await store.init();
    await store.login({ id: '4', username: 'dora' });
    vi.setSystemTime(new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000));
    const newStore = useAuthStore.getState();
    await newStore.init();
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    vi.useRealTimers();
  });
});
