import type { HitlUploadConfirmation } from './hitlUpload';

export type AssistantRole = 'user' | 'assistant';

export interface AssistantAttachment {
  id: string;
  name: string;
  url: string;
}

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: number;
  attachments: AssistantAttachment[];
  status?: 'streaming' | 'done' | 'error';
}

export interface AssistantSession {
  id: string;
  threadId: string;
  title: string;
  preview: string;
  updatedAt: number;
  messages: AssistantMessage[];
}

export interface AssistantApiEnvelope<T> {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
}

export interface AssistantThreadData {
  thread_id?: string;
}

export interface AssistantCheckThreadData {
  exist?: boolean;
  exists?: boolean;
  valid?: boolean;
  thread_id?: string;
}

export interface AssistantCosPresignData {
  uploadUrl: string;
  contentType: string;
  accessUrl: string;
}

export interface AssistantChatRequest {
  thread_id: string;
  query: string;
  user_id: string;
  image_url?: string;
  space_id?: number | null;
}

export interface AssistantResumeChatRequest {
  thread_id: string;
  query: string;
  user_id: string;
  space_id?: number | null;
  user_confirmed: boolean;
  modified_data?: Record<string, unknown> | null;
}

export interface AssistantChatImage {
  url?: string;
  imageUrl?: string;
  image_url?: string;
  src?: string;
  name?: string;
  title?: string;
  filename?: string;
  file_name?: string;
}

export interface AssistantChatData extends Record<string, unknown> {
  reply?: string;
  images?: Array<string | AssistantChatImage>;
  image_urls?: Array<string | AssistantChatImage>;
  imageUrls?: Array<string | AssistantChatImage>;
  upload_confirmation?: HitlUploadConfirmation;
  image_url?: string;
  picture_url?: string;
  picture_id?: string | number;
  space_id?: number | null;
}

export interface AssistantStreamEventPayload extends Record<string, unknown> {
  type?: string;
  data?: Record<string, unknown> | string | null;
}

export interface AssistantStreamHandlers {
  onMessage?: (chunk: string) => void;
  onImages?: (images: Array<string | AssistantChatImage>) => void;
  onInterrupt?: (data: AssistantChatData) => void;
  onDone?: (data: AssistantChatData | null) => void;
  onError?: (message: string) => void;
}
