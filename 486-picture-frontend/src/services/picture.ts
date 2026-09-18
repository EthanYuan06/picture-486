import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import type { Picture, PictureQueryRequest, PictureReviewBatchRequest, PictureReviewSingleRequest, Page, PictureDeleteRequest, PictureDeleteBatchRequest, PictureEditRequest, PictureEditBatchRequest } from '../types/picture';

type ApiResp<T> = { code: number; data: T; message?: string };

export async function uploadPicture(file: File, params?: {
  id?: string;
  spaceId?: string;
}): Promise<Picture | null> {
  const auth = useAuthStore.getState();
  const formData = new FormData();
  formData.append('file', file, file.name);
  if (params) {
    if (params.id) formData.append('id', params.id);
    if (params.spaceId) formData.append('spaceId', params.spaceId);
  }

  try {
    const resp = await fetch(API_ROUTES.PICTURE_UPLOAD, {
      method: 'POST',
      headers: { ...auth.csrfHeader },
      body: formData,
      credentials: 'include',
    });
    const data: ApiResp<Picture> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error(data.message || '上传失败');
  } catch (error: any) {
    console.error('Upload picture failed', error);
    throw error;
  }
}

export async function uploadPictureBatch(
  files: File[],
  spaceId?: string
): Promise<Picture[]> {
  const auth = useAuthStore.getState();
  const formData = new FormData();
  files.forEach(file => formData.append('file', file, file.name));
  if (spaceId) {
    formData.append('spaceId', spaceId);
  }

  try {
    const resp = await fetch(API_ROUTES.PICTURE_UPLOAD_BATCH, {
      method: 'POST',
      headers: { ...auth.csrfHeader },
      body: formData,
      credentials: 'include',
    });
    const data: ApiResp<Picture[]> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error(data.message || '批量上传失败');
  } catch (error: any) {
    console.error('Batch upload picture failed', error);
    throw error;
  }
}

export async function editPicture(params: PictureEditRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_EDIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    if (data.code === 0) {
      return true;
    }
    throw new Error(data.message || '保存失败');
  } catch (error: any) {
    console.error('Edit picture failed', error);
    throw error;
  }
}

export async function editPictureBatch(params: PictureEditBatchRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_EDIT_BATCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    if (data.code === 0) {
      return true;
    }
    throw new Error(data.message || '批量保存失败');
  } catch (error: any) {
    console.error('Batch edit picture failed', error);
    throw error;
  }
}

export async function listPictureByPage(params: PictureQueryRequest): Promise<Page<Picture> | null> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_LIST_PAGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<Page<Picture>> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
  } catch (error) {
    console.error('List picture failed', error);
  }
  return null;
}

export async function listPictureVoByPage(params: PictureQueryRequest): Promise<Page<Picture> | null> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_LIST_PAGE_VO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<Page<Picture>> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error(data.message || '获取相册图片失败');
  } catch (error) {
    console.error('List picture vo failed', error);
    throw error;
  }
}

export async function getPictureById(id: string): Promise<Picture> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(`${API_ROUTES.PICTURE_GET}?id=${id}`, {
      method: 'GET',
      headers: { ...auth.csrfHeader },
      credentials: 'include',
    });
    const data: ApiResp<Picture> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error(data.message || '获取图片详情失败');
  } catch (error) {
    console.error('Get picture failed', error);
    throw error;
  }
}

export async function getPictureVoById(id: string): Promise<Picture> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(`${API_ROUTES.PICTURE_GET_VO}?id=${id}`, {
      method: 'GET',
      headers: { ...auth.csrfHeader },
      credentials: 'include',
    });
    const data: ApiResp<Picture> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error(data.message || '获取图片详情失败');
  } catch (error) {
    console.error('Get picture vo failed', error);
    throw error;
  }
}

export async function doPictureReview(params: PictureReviewSingleRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_REVIEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0;
  } catch (error) {
    console.error('Review picture failed', error);
    return false;
  }
}

export async function doPictureReviewBatch(params: PictureReviewBatchRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_REVIEW_BATCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0;
  } catch (error) {
    console.error('Review picture batch failed', error);
    return false;
  }
}

export async function deletePicture(params: PictureDeleteRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_DELETE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0;
  } catch (error) {
    console.error('Delete picture failed', error);
    return false;
  }
}

export async function deletePictureBatch(params: PictureDeleteBatchRequest): Promise<boolean> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_DELETE_BATCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
      body: JSON.stringify(params),
      credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0;
  } catch (error) {
    console.error('Delete picture batch failed', error);
    return false;
  }
}

export async function getPictureTagCategory(): Promise<{ tagList: string[]; categoryList: string[] } | null> {
  const auth = useAuthStore.getState();
  try {
    const resp = await fetch(API_ROUTES.PICTURE_TAG_CATEGORY, {
      method: 'GET',
      headers: { ...auth.csrfHeader },
      credentials: 'include',
    });
    const data: ApiResp<{ tagList: string[]; categoryList: string[] }> = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
  } catch (error) {
    console.error('Get tag category failed', error);
  }
  return null;
}
