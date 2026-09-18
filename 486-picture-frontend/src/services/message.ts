import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import type { MessageVo, MessageQueryRequest, MessageAddRequest } from '../types/message';

type ApiResp<T> = { code: number; data: T; message?: string };

export async function sendMessage(params: MessageAddRequest): Promise<boolean> {
    const auth = useAuthStore.getState();
    const resp = await fetch(API_ROUTES.MESSAGE_SEND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
        body: JSON.stringify(params),
        credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0 && data.data;
}

export async function listMessageVoByPage(params: MessageQueryRequest): Promise<{ records: MessageVo[]; total: number }> {
    const auth = useAuthStore.getState();
    const resp = await fetch(API_ROUTES.MESSAGE_LIST_PAGE_VO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.csrfHeader },
        body: JSON.stringify(params),
        credentials: 'include',
    });
    const data: ApiResp<{ records: MessageVo[]; total: number }> = await resp.json();
    if (data.code === 0 && data.data) {
        return data.data;
    }
    return { records: [], total: 0 };
}

export async function getUnreadMessageCount(): Promise<number> {
    const auth = useAuthStore.getState();
    const resp = await fetch(API_ROUTES.MESSAGE_UNREAD_COUNT, {
        method: 'GET',
        headers: { ...auth.csrfHeader },
        credentials: 'include',
    });
    const data: ApiResp<number> = await resp.json();
    if (data.code === 0 && typeof data.data === 'number') {
        return data.data;
    }
    return 0;
}

export async function readMessage(id: string | number): Promise<boolean> {
    const auth = useAuthStore.getState();
    const resp = await fetch(`${API_ROUTES.MESSAGE_READ}?id=${id}`, {
        method: 'GET',
        headers: { ...auth.csrfHeader },
        credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0 && data.data;
}

export async function readAllMessage(): Promise<boolean> {
    const auth = useAuthStore.getState();
    const resp = await fetch(API_ROUTES.MESSAGE_READ_ALL, {
        method: 'GET',
        headers: { ...auth.csrfHeader },
        credentials: 'include',
    });
    const data: ApiResp<boolean> = await resp.json();
    return data.code === 0 && data.data;
}
