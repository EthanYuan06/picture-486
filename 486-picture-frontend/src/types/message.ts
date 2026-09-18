export interface MessageVo {
    id: string | number;
    receiveUserId: string | number;
    title: string;
    content: string;
    type: number; // 0-System
    status: number; // 0-Unread, 1-Read
    createTime: string;
    updateTime: string;
}

export interface MessageAddRequest {
    receiveUserId: string | number;
    title: string;
    content: string;
}

export interface MessageQueryRequest {
    current?: number;
    pageSize?: number;
    status?: number; // 0-Unread, 1-Read
    sortField?: string;
    sortOrder?: string;
}
