import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import type { User } from '../types';
import type { UserInfo } from '../types/auth';

type ApiResp<T> = { code: number; data: T; message?: string };

// Cache removed, use useUserMapStore instead
/*
const USERNAME_CACHE_KEY = 'subarupic:userNameMap';
const userNameCache = new Map<string, string>();

function hydrateUserNameCache() {
  try {
    const raw = sessionStorage.getItem(USERNAME_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [id, name] of Object.entries(parsed)) {
      if (id && name) userNameCache.set(id, name);
    }
  } catch {
    return;
  }
}

function persistUserNameCache() {
  try {
    const obj: Record<string, string> = {};
    for (const [id, name] of userNameCache.entries()) obj[id] = name;
    sessionStorage.setItem(USERNAME_CACHE_KEY, JSON.stringify(obj));
  } catch {
    return;
  }
}

hydrateUserNameCache();
*/

function toUserInfo(u: User): UserInfo {
  return {
    id: String(u.id ?? ''),
    username: u.userName ?? u.userAccount ?? '',
    email: u.userEmail,
    avatarUrl: u.userAvatar || undefined,
    roles: u.userRole ? [u.userRole] : undefined,
  };
}

function withCacheBust(url: string): string {
  const ts = Date.now();
  return `${url}${url.includes('?') ? '&' : '?'}ts=${ts}`;
}

export async function postLogin(params: { userAccount: string; userPassword: string }): Promise<User | null> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });

    if (!resp.ok) {
      console.warn(`Login failed: ${resp.status} ${resp.statusText}`);
      return null;
    }

    const data: ApiResp<User | null> = await resp.json();
    if (data.code === 0 && data.data) {
      await auth.login(toUserInfo(data.data));
      return data.data;
    }
  } catch (error) {
    console.error('Login error:', error);
  }
  return null;
}

export async function getCurrentLoginUser(): Promise<User | null> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.GET_LOGIN, {
      method: 'GET',
      headers: { ...auth.csrfHeader },
      credentials: 'include',
    });

    if (!resp.ok) {
      // If server returns 500 or 401, treat as not logged in
      console.warn(`Failed to fetch login user: ${resp.status} ${resp.statusText}`);
      return null;
    }

    const data: ApiResp<User | null> = await resp.json();
    if (data.code === 0 && data.data) {
      // Update global user info
      await auth.login(toUserInfo(data.data));
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching login user:', error);
  }
  return null;
}

export async function postLogout(): Promise<boolean> {
  const auth = useAuthStore.getState();
  const resp = await fetch(API_ROUTES.LOGOUT, {
    method: 'POST',
    headers: { ...auth.csrfHeader },
    credentials: 'include',
  });
  const data: ApiResp<unknown> = await resp.json();
  await auth.logout();
  return data.code === 0;
}

export interface UserUpdateRequest {
  id: number | string;
  userName?: string;
  userProfile?: string;
  userRole?: string;
  userEmail?: string;
  userAvatar?: string;
}

export async function updateUser(params: UserUpdateRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  const resp = await fetch(API_ROUTES.USER_UPDATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
    body: JSON.stringify(params),
    credentials: 'include',
  });
  const data: ApiResp<boolean> = await resp.json();
  if (data.code === 0 && data.data) {
    // Refresh user info
    await getCurrentLoginUser();
    return true;
  }
  return false;
}

export async function uploadUserAvatar(file: File, id?: string | number): Promise<string | null> {
  const auth = useAuthStore.getState();
  const effectiveId = id ?? auth.userInfo?.id;
  if (effectiveId === null || effectiveId === undefined || String(effectiveId).trim().length === 0) {
    throw new Error('id is required');
  }
  const formData = new FormData();
  formData.append('file', file);

  const baseUrl = API_ROUTES.USER_AVATAR_UPLOAD;
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}id=${encodeURIComponent(String(effectiveId))}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ...auth.csrfHeader },
    body: formData,
    credentials: 'include',
  });
  const data: ApiResp<string | boolean> = await resp.json();

  if (data.code === 0) {
    // Refresh user info
    await getCurrentLoginUser();
    const nextUserInfo = useAuthStore.getState().userInfo;
    if (nextUserInfo?.avatarUrl) {
      await useAuthStore.getState().login({ ...nextUserInfo, avatarUrl: withCacheBust(nextUserInfo.avatarUrl) });
    }
    // If the API returns the URL directly, return it. Otherwise, return null to signal success but no URL.
    // Based on doc, it returns boolean true.
    return typeof data.data === 'string' ? data.data : 'success';
  }
  throw new Error(data.message || '头像上传失败');
}

export function extractUserName(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null;
  const u = user as Record<string, unknown>;
  const candidates = [
    u.userName, 
    u.username, 
    u.userAccount, 
    u.nickname, 
    u.nickName, 
    u.userProfile, 
    u.name
  ].filter((v) => typeof v === 'string') as string[];
  
  const name = candidates.map((s) => s.trim()).find((s) => s.length > 0);
  return name || null;
}

export async function getUserBasicInfoById(id: string): Promise<unknown | null> {
  const auth = useAuthStore.getState();
  const routes = [API_ROUTES.USER_GET_VO, API_ROUTES.USER_GET].filter(Boolean);
  for (const route of routes) {
    try {
      const url = `${route}?id=${encodeURIComponent(id)}`;
      const resp = await fetch(url, { method: 'GET', headers: { ...auth.csrfHeader }, credentials: 'include' });
      const data: ApiResp<unknown> = await resp.json();
      if (data.code === 0 && data.data) return data.data;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchUserVoById(id: string): Promise<unknown | null> {
  return getUserBasicInfoById(id);
}

/*
export function getUserNameMapSnapshot(): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [id, name] of userNameCache.entries()) obj[id] = name;
  return obj;
}

export async function getUserNameById(id: string): Promise<string | null> {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  const cached = userNameCache.get(normalizedId);
  if (cached) return cached;
  const vo = await getUserBasicInfoById(normalizedId);
  const name = extractUserName(vo);
  if (!name) return null;
  userNameCache.set(normalizedId, name);
  persistUserNameCache();
  return name;
}

export async function ensureUserNames(ids: Array<string | undefined | null>): Promise<Record<string, string>> {
  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id || '').trim()).filter((id) => id.length > 0))
  );
  const missingIds = uniqueIds.filter((id) => !userNameCache.has(id));
  if (missingIds.length > 0) {
    await Promise.all(missingIds.map((id) => getUserNameById(id)));
  }
  const out: Record<string, string> = {};
  for (const id of uniqueIds) {
    const name = userNameCache.get(id);
    if (name) out[id] = name;
  }
  return out;
}
*/

export interface UserQueryRequest {
  current?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: string;
  id?: number | string;
  userName?: string;
  userProfile?: string;
  userEmail?: string;
  userRole?: string;
}

export async function listUserByPage(params: UserQueryRequest): Promise<{ records: User[]; total: number }> {
  const auth = useAuthStore.getState();
  const resp = await fetch(API_ROUTES.USER_LIST_PAGE_VO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
    body: JSON.stringify(params),
    credentials: 'include',
  });
  const data: ApiResp<{ records: User[]; total: number }> = await resp.json();
  if (data.code === 0 && data.data) {
    return data.data;
  }
  return { records: [], total: 0 };
}

export async function deleteUser(id: number | string): Promise<boolean> {
  const auth = useAuthStore.getState();
  const resp = await fetch(API_ROUTES.USER_DELETE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
    body: JSON.stringify({ id }),
    credentials: 'include',
  });
  const data: ApiResp<boolean> = await resp.json();
  return data.code === 0;
}
