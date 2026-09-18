import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import { Space, SpaceAddRequest, SpaceQueryRequest, Page, SpaceUpdateRequest, SpaceLevelOption } from '../types/space';

type ApiResp<T> = { code: number; data: T; message?: string };

const SPACE_NAME_CACHE_KEY = 'subarupic:spaceNameMap';
const spaceNameCache = new Map<string, string>();

function hydrateSpaceNameCache() {
  try {
    const raw = sessionStorage.getItem(SPACE_NAME_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [id, name] of Object.entries(parsed)) {
      const k = String(id || '').trim();
      const v = String(name || '').trim();
      if (k && v) spaceNameCache.set(k, v);
    }
  } catch {
    return;
  }
}

function persistSpaceNameCache() {
  try {
    const obj: Record<string, string> = {};
    for (const [id, name] of spaceNameCache.entries()) obj[id] = name;
    sessionStorage.setItem(SPACE_NAME_CACHE_KEY, JSON.stringify(obj));
  } catch {
    return;
  }
}

hydrateSpaceNameCache();

export function getSpaceNameMapSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, name] of spaceNameCache.entries()) out[id] = name;
  return out;
}

async function fetchSpaceVoById(id: string): Promise<Space | null> {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  const auth = useAuthStore.getState();
  const url = `${API_ROUTES.SPACE_GET_VO}?id=${encodeURIComponent(normalizedId)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: { ...auth.csrfHeader },
    credentials: 'include',
  });
  const data: ApiResp<Space | null> = await resp.json();
  if (data.code === 0 && data.data) return data.data;
  return null;
}

export async function getSpaceNameById(id: string): Promise<string | null> {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  const cached = spaceNameCache.get(normalizedId);
  if (cached) return cached;
  const vo = await fetchSpaceVoById(normalizedId);
  const name = vo?.spaceName ? String(vo.spaceName).trim() : '';
  if (!name) return null;
  spaceNameCache.set(normalizedId, name);
  persistSpaceNameCache();
  return name;
}

export async function ensureSpaceNames(ids: Array<string | undefined | null>): Promise<Record<string, string>> {
  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id || '').trim()).filter((id) => id.length > 0))
  );
  const missingIds = uniqueIds.filter((id) => !spaceNameCache.has(id));
  if (missingIds.length > 0) {
    await Promise.all(missingIds.map((id) => getSpaceNameById(id)));
  }
  const out: Record<string, string> = {};
  for (const id of uniqueIds) {
    const name = spaceNameCache.get(id);
    if (name) out[id] = name;
  }
  return out;
}

/**
 * 创建相册
 * @param params 创建参数
 * @returns 创建的相册 ID
 */
export const addSpace = async (params: SpaceAddRequest): Promise<string> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_ADD, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (data.code === 0) {
    return String(data.data);
  }
  throw new Error(data.message || '创建相册失败');
};

/**
 * 更新相册 (User)
 * @param params 更新参数
 * @returns boolean
 */
export const updateSpace = async (params: SpaceUpdateRequest): Promise<boolean> => {
  const { csrfHeader } = useAuthStore.getState();
  const payload: SpaceUpdateRequest = { ...params, id: String(params.id) };
  const response = await fetch(API_ROUTES.SPACE_EDIT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '更新相册失败');
};

/**
 * 更新相册 (Admin)
 * @param params 更新参数
 * @returns boolean
 */
export const updateSpaceAdmin = async (params: SpaceUpdateRequest): Promise<boolean> => {
  const { csrfHeader } = useAuthStore.getState();
  const payload: SpaceUpdateRequest = { ...params, id: String(params.id) };
  const response = await fetch(API_ROUTES.SPACE_UPDATE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '更新相册失败');
};

export async function uploadSpaceCover(file: File, id: string): Promise<boolean> {
  const auth = useAuthStore.getState();
  const normalizedId = String(id || '').trim();
  if (!normalizedId) throw new Error('id is required');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('id', normalizedId);

  const headers: Record<string, string> = { ...auth.csrfHeader };
  if (auth.csrfToken) headers.Authorization = auth.csrfToken;

  const url = API_ROUTES.PICTURE_UPLOAD_COVER;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });
  const data: ApiResp<boolean> = await resp.json();
  if (data.code === 0) return !!data.data;
  throw new Error(data.message || '封面上传失败');
}

/**
 * 删除相册
 * @param id 相册 ID
 * @returns boolean
 */
export const deleteSpace = async (id: string): Promise<boolean> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_DELETE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify({ id: String(id) }),
  });

  const data = await response.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '删除相册失败');
};

/**
 * 分页获取相册列表 (User/VO)
 * @param params 查询参数
 * @returns 相册列表分页数据
 */
export const listSpaceVoByPage = async (params: SpaceQueryRequest): Promise<Page<Space>> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_LIST_PAGE_VO, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (data.code === 0) {
    return data.data;
  }
  throw new Error(data.message || '获取相册列表失败');
};

/**
 * 分页获取相册列表 (Admin)
 * @param params 查询参数
 * @returns 相册列表分页数据
 */
export const listSpaceByPage = async (params: SpaceQueryRequest): Promise<Page<Space>> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_LIST_PAGE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (data.code === 0) {
    return data.data;
  }
  throw new Error(data.message || '获取相册列表失败');
};

/**
 * 根据 ID 获取相册详情 (User/VO)
 * @param id 相册 ID
 * @returns 相册详情
 */
export const getSpaceById = async (id: string): Promise<Space> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(`${API_ROUTES.SPACE_GET_VO}?id=${encodeURIComponent(String(id))}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
  });

  const data = await response.json();
  if (data.code === 0 && data.data) {
    return data.data;
  }
  const msg = typeof data.message === 'string' ? data.message : '';
  throw new Error(msg && msg.toLowerCase() !== 'ok' ? msg : '获取相册详情失败');
};

/**
 * 根据 ID 获取相册详情 (Admin)
 * @param id 相册 ID
 * @returns 相册详情
 */
export const getSpaceByIdAdmin = async (id: string): Promise<Space> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(`${API_ROUTES.SPACE_GET}?id=${encodeURIComponent(String(id))}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
  });

  const data = await response.json();
  if (data.code === 0 && data.data) {
    return data.data;
  }
  const msg = typeof data.message === 'string' ? data.message : '';
  throw new Error(msg && msg.toLowerCase() !== 'ok' ? msg : '获取相册详情失败');
};

/**
 * 获取相册等级列表
 * @returns 相册等级列表
 */
export const listSpaceLevels = async (): Promise<SpaceLevelOption[]> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_LIST_LEVEL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
  });

  const data = await response.json();
  if (data.code === 0 && data.data) {
    return data.data;
  }
  throw new Error(data.message || '获取相册等级失败');
};
