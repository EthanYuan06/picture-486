import { API_ROUTES } from '../config';
import { useAuthStore } from '../stores/auth';
import type {
  AssistantApiEnvelope,
  AssistantChatData,
  AssistantChatImage,
  AssistantChatRequest,
  AssistantCheckThreadData,
  AssistantCosPresignData,
  AssistantResumeChatRequest,
  AssistantStreamEventPayload,
  AssistantStreamHandlers,
  AssistantThreadData,
} from '../types/assistant';

function getAiHeaders(
  includeJsonContentType = true,
  acceptSse = false
): Record<string, string> {
  const auth = useAuthStore.getState();
  return {
    ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(acceptSse ? { Accept: 'text/event-stream' } : {}),
    ...auth.csrfHeader,
  };
}

function createAiRequestInit(
  method: 'GET' | 'POST' | 'DELETE',
  payload?: Record<string, unknown>,
  acceptSse = false
): RequestInit {
  return {
    method,
    headers: getAiHeaders(method !== 'GET', acceptSse),
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    credentials: 'include',
  };
}

function isWrappedResponse<T>(payload: unknown): payload is AssistantApiEnvelope<T> {
  return typeof payload === 'object' && payload !== null && 'code' in payload;
}

async function parseAiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as AssistantApiEnvelope<T> | T;

  if (isWrappedResponse<T>(payload)) {
    if (payload.code === 200 || payload.code === 0) {
      if (payload.data !== undefined) {
        return payload.data as T;
      }

      const { code, msg, message, data, ...rest } = payload as AssistantApiEnvelope<T> &
        Record<string, unknown>;
      return rest as T;
    }
    throw new Error(payload.msg || payload.message || 'AI 服务请求失败');
  }

  return payload as T;
}

function normalizeStreamPayload(
  value: unknown,
  fallbackType = ''
): AssistantStreamEventPayload {
  if (typeof value === 'object' && value !== null) {
    return value as AssistantStreamEventPayload;
  }
  return {
    type: fallbackType,
    data: typeof value === 'string' ? value : null,
  };
}

function isInterruptConfirmationPayload(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === 'string' ||
    typeof value.introduction === 'string' ||
    typeof value.category === 'string' ||
    Array.isArray(value.tags) ||
    'space_id' in value
  );
}

function extractObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function extractStreamText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  const payload = extractObject(value);
  if (!payload) {
    return '';
  }

  const candidates = [
    payload.content,
    payload.text,
    payload.delta,
    payload.token,
    payload.reply,
    payload.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return '';
}

function extractStreamImages(
  value: unknown
): Array<string | AssistantChatImage> {
  if (Array.isArray(value)) {
    return value as Array<string | AssistantChatImage>;
  }

  const payload = extractObject(value);
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload.urls)) {
    return payload.urls as Array<string | AssistantChatImage>;
  }

  if (Array.isArray(payload.images)) {
    return payload.images as Array<string | AssistantChatImage>;
  }

  if (Array.isArray(payload.image_urls)) {
    return payload.image_urls as Array<string | AssistantChatImage>;
  }

  return [];
}

function extractAssistantChatData(value: unknown): AssistantChatData | null {
  const payload = extractObject(value);
  if (!payload) {
    return null;
  }

  if (!payload.upload_confirmation && isInterruptConfirmationPayload(payload)) {
    return {
      upload_confirmation: payload,
    } as AssistantChatData;
  }

  return payload as AssistantChatData;
}

function parseStreamErrorMessage(responseText: string): string {
  try {
    const payload = JSON.parse(responseText) as AssistantApiEnvelope<unknown> &
      Record<string, unknown>;

    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const details = payload.detail
        .map((item) => {
          if (typeof item !== 'object' || item === null) {
            return '';
          }

          const detailItem = item as {
            loc?: Array<string | number>;
            msg?: string;
          };
          const location = Array.isArray(detailItem.loc)
            ? detailItem.loc.join('.')
            : 'body';
          return detailItem.msg ? `${location}: ${detailItem.msg}` : '';
        })
        .filter((message) => message.length > 0);

      if (details.length > 0) {
        return details.join('；');
      }
    }

    const data = extractObject(payload.data);
    if (data && typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }

    return payload.msg || payload.message || responseText || 'AI 流式请求失败';
  } catch {
    return responseText || 'AI 流式请求失败';
  }
}

export function parseAssistantSseRecord(record: string): {
  eventType: string;
  payload: AssistantStreamEventPayload;
  rawData: string;
} | null {
  const lines = record
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(':'));

  if (lines.length === 0) {
    return null;
  }

  let eventType = '';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
      return;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  });

  const rawData = dataLines.join('\n').trim();
  if (!rawData) {
    return null;
  }

  if (rawData === '[DONE]') {
    return {
      eventType: eventType || 'done',
      payload: {
        type: 'done',
        data: null,
      },
      rawData,
    };
  }

  let parsed: unknown = rawData;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    parsed = rawData;
  }

  const payload = normalizeStreamPayload(parsed, eventType);

  return {
    eventType: eventType || payload.type || '',
    payload,
    rawData,
  };
}

async function consumeAssistantStream(
  response: Response,
  handlers: AssistantStreamHandlers
): Promise<AssistantChatData | null> {
  if (!response.ok) {
    throw new Error(parseStreamErrorMessage(await response.text()));
  }

  if (!response.body) {
    throw new Error('当前浏览器环境不支持流式响应');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: AssistantChatData | null = null;
  let shouldStop = false;

  const handleRecord = (record: string) => {
    const parsedRecord = parseAssistantSseRecord(record);
    if (!parsedRecord) {
      return;
    }

    if (parsedRecord.rawData === '[DONE]') {
      handlers.onDone?.(finalData);
      shouldStop = true;
      return;
    }

    const { eventType, payload } = parsedRecord;
    const type = eventType || payload.type || '';
    const data = payload.data ?? payload;

    switch (type) {
      case 'message': {
        const chunk = extractStreamText(data);
        if (chunk) {
          handlers.onMessage?.(chunk);
        }
        return;
      }
      case 'images': {
        const images = extractStreamImages(data);
        if (images.length > 0) {
          handlers.onImages?.(images);
        }
        return;
      }
      case 'interrupt': {
        const chatData = extractAssistantChatData(data);
        if (chatData) {
          finalData = chatData;
          handlers.onInterrupt?.(chatData);
        }
        shouldStop = true;
        return;
      }
      case 'error': {
        const message = extractStreamText(data) || 'AI 流式响应异常';
        handlers.onError?.(message);
        throw new Error(message);
      }
      case 'done': {
        const chatData = extractAssistantChatData(data);
        if (chatData) {
          finalData = chatData;
        }
        handlers.onDone?.(chatData);
        shouldStop = true;
        return;
      }
      default: {
        const chatData = extractAssistantChatData(data);
        if (chatData && (chatData.reply || chatData.upload_confirmation)) {
          finalData = chatData;
          handlers.onDone?.(chatData);
          shouldStop = true;
        }
      }
    }
  };

  while (!shouldStop) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const records = buffer.split(/\r?\n\r?\n/);
    buffer = records.pop() ?? '';
    records.forEach(handleRecord);

    if (done) {
      if (buffer.trim()) {
        handleRecord(buffer);
      }
      break;
    }
  }

  return finalData;
}

export async function createAssistantThread(): Promise<string> {
  const response = await fetch(
    API_ROUTES.AI_CREATE_THREAD,
    createAiRequestInit('GET')
  );
  const data = await parseAiResponse<AssistantThreadData>(response);
  const threadId = typeof data.thread_id === 'string' ? data.thread_id : '';
  if (!threadId) {
    throw new Error('创建会话失败');
  }
  return threadId;
}

export async function checkAssistantThread(threadId: string): Promise<boolean> {
  const response = await fetch(
    `${API_ROUTES.AI_CHECK_THREAD}/${encodeURIComponent(threadId)}`,
    createAiRequestInit('GET')
  );
  const data = await parseAiResponse<AssistantCheckThreadData | boolean>(response);

  if (typeof data === 'boolean') {
    return data;
  }

  if (typeof data.exist === 'boolean') {
    return data.exist;
  }

  if (typeof (data as AssistantCheckThreadData & { exists?: boolean }).exists === 'boolean') {
    return Boolean((data as AssistantCheckThreadData & { exists?: boolean }).exists);
  }

  if (typeof data.valid === 'boolean') {
    return data.valid;
  }

  return typeof data.thread_id === 'string' && data.thread_id.length > 0;
}

export async function deleteAssistantThread(threadId: string): Promise<boolean> {
  const response = await fetch(
    `${API_ROUTES.AI_DELETE_THREAD}/${encodeURIComponent(threadId)}`,
    createAiRequestInit('DELETE')
  );

  const data = await parseAiResponse<boolean | Record<string, unknown>>(response);
  if (typeof data === 'boolean') {
    return data;
  }
  return true;
}

export async function getAssistantCosPresign(
  filename: string
): Promise<AssistantCosPresignData> {
  const response = await fetch(
    `${API_ROUTES.AI_COS_PRESIGN}?filename=${encodeURIComponent(filename)}`,
    createAiRequestInit('GET')
  );
  const data = await parseAiResponse<AssistantCosPresignData>(response);
  if (!data.uploadUrl || !data.contentType || !data.accessUrl) {
    throw new Error('获取 COS 预签名地址失败');
  }
  return data;
}

export async function uploadAssistantImageToCos(
  file: File
): Promise<{ imageUrl: string }> {
  const filename = `upload_${Date.now()}_${file.name}`;
  const presign = await getAssistantCosPresign(filename);

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': presign.contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('上传图片到 COS 失败');
  }

  return {
    imageUrl: presign.accessUrl,
  };
}

export async function sendAssistantChatMessage(
  payload: AssistantChatRequest
): Promise<AssistantChatData> {
  const response = await fetch(
    API_ROUTES.CHAT,
    createAiRequestInit('POST', payload)
  );

  return parseAiResponse<AssistantChatData>(response);
}

export async function streamAssistantChatMessage(
  payload: AssistantChatRequest,
  handlers: AssistantStreamHandlers = {},
  signal?: AbortSignal
): Promise<AssistantChatData | null> {
  const response = await fetch(API_ROUTES.CHAT_STREAM, {
    ...createAiRequestInit('POST', payload, true),
    signal,
  });

  return consumeAssistantStream(response, handlers);
}

export async function resumeAssistantChatStream(
  payload: AssistantResumeChatRequest,
  handlers: AssistantStreamHandlers = {},
  signal?: AbortSignal
): Promise<AssistantChatData | null> {
  const response = await fetch(API_ROUTES.CHAT_STREAM_RESUME, {
    ...createAiRequestInit('POST', payload, true),
    signal,
  });

  return consumeAssistantStream(response, handlers);
}
