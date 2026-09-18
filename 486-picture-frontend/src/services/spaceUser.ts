
import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import { SpaceUser, SpaceUserAddRequest, SpaceUserEditRequest, SpaceUserQueryRequest } from '../types/spaceUser';

type ApiResp<T> = { code: number; data: T; message?: string };

/**
 * 添加成员到相册
 */
export const addSpaceUser = async (params: SpaceUserAddRequest): Promise<string> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_USER_ADD, {
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
  throw new Error(data.message || '添加成员失败');
};

/**
 * 从相册中移除成员
 */
export const deleteSpaceUser = async (id: string): Promise<boolean> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_USER_DELETE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify({ id }),
  });

  const data = await response.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '移除成员失败');
};

/**
 * 查询某个成员在某个相册中的信息
 */
export const getSpaceUser = async (params: SpaceUserQueryRequest): Promise<SpaceUser> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_USER_GET_VO, {
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
  throw new Error(data.message || '获取成员信息失败');
};

/**
 * 查询相册成员列表
 */
export const listSpaceUser = async (params: SpaceUserQueryRequest): Promise<SpaceUser[]> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_USER_LIST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (data.code === 0) {
    return data.data || [];
  }
  throw new Error(data.message || '获取成员列表失败');
};

/**
 * 编辑成员信息
 */
export const editSpaceUser = async (params: SpaceUserEditRequest): Promise<boolean> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_USER_EDIT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (data.code === 0) {
    return true;
  }
  throw new Error(data.message || '编辑成员失败');
};

/**
 * 查询我加入的团队空间列表
 */
export const listMyTeamSpaces = async (): Promise<SpaceUser[]> => {
  const { csrfHeader } = useAuthStore.getState();
  const response = await fetch(API_ROUTES.SPACE_USER_LIST_ME, {
    method: 'GET',
    headers: {
      ...csrfHeader,
    },
  });

  const data = await response.json();
  if (data.code === 0) {
    return data.data || [];
  }
  throw new Error(data.message || '获取团队空间列表失败');
};
