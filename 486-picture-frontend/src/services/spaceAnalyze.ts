import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import {
  SpaceAnalyzeRequest,
  SpaceUsageAnalyzeResponse,
  SpaceCategoryAnalyzeResponse,
  SpaceTagAnalyzeResponse,
  SpaceSizeAnalyzeResponse,
  SpaceUserAnalyzeRequest,
  SpaceUserAnalyzeResponse
} from '../types/spaceAnalyze';

type ApiResp<T> = { code: number; data: T; message?: string };

const getHeaders = () => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const csrfHeader = useAuthStore.getState().csrfHeader;
  if (csrfHeader) {
    Object.assign(headers, csrfHeader);
  }
  return headers;
};

export const spaceAnalyzeService = {
  getUsageAnalyze: async (data: SpaceAnalyzeRequest) => {
    const res = await fetch(API_ROUTES.SPACE_ANALYZE_USAGE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return (await res.json()) as ApiResp<SpaceUsageAnalyzeResponse>;
  },

  getCategoryAnalyze: async (data: SpaceAnalyzeRequest) => {
    const res = await fetch(API_ROUTES.SPACE_ANALYZE_CATEGORY, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return (await res.json()) as ApiResp<SpaceCategoryAnalyzeResponse[]>;
  },

  getTagAnalyze: async (data: SpaceAnalyzeRequest) => {
    const res = await fetch(API_ROUTES.SPACE_ANALYZE_TAG, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return (await res.json()) as ApiResp<SpaceTagAnalyzeResponse[]>;
  },

  getSizeAnalyze: async (data: SpaceAnalyzeRequest) => {
    const res = await fetch(API_ROUTES.SPACE_ANALYZE_SIZE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return (await res.json()) as ApiResp<SpaceSizeAnalyzeResponse[]>;
  },

  getUserAnalyze: async (data: SpaceUserAnalyzeRequest) => {
    const res = await fetch(API_ROUTES.SPACE_ANALYZE_USER, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return (await res.json()) as ApiResp<SpaceUserAnalyzeResponse[]>;
  },
};
