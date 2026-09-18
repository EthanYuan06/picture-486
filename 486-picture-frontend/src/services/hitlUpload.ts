import type {
  ContinueHitlUploadRequest,
  HitlChatData,
  StartHitlUploadRequest,
} from '../types/hitlUpload';
import {
  resumeAssistantChatStream,
  streamAssistantChatMessage,
} from './assistant';
import { uploadPicture } from './picture';

export async function startHitlUpload(
  payload: StartHitlUploadRequest
): Promise<HitlChatData> {
  let streamedReply = '';
  const data = await streamAssistantChatMessage(payload, {
    onMessage: (chunk) => {
      streamedReply += chunk;
    },
  });

  return {
    ...(data ?? {}),
    reply:
      streamedReply ||
      (data && typeof data.reply === 'string' ? data.reply : ''),
  };
}

export async function continueHitlUpload(
  payload: ContinueHitlUploadRequest
): Promise<HitlChatData> {
  let streamedReply = '';
  const data = await resumeAssistantChatStream(payload, {
    onMessage: (chunk) => {
      streamedReply += chunk;
    },
  });

  return {
    ...(data ?? {}),
    reply:
      streamedReply ||
      (data && typeof data.reply === 'string' ? data.reply : ''),
  };
}

export async function uploadHitlTempImage(
  file: File,
  spaceId: number | null
): Promise<{ imageUrl: string; pictureId?: string }> {
  // Reuse the existing upload endpoint as a temporary image URL provider.
  // Replace this wrapper with a dedicated COS/temp-upload API when backend is ready.
  const uploaded = await uploadPicture(
    file,
    spaceId !== null ? { spaceId: String(spaceId) } : undefined
  );

  if (!uploaded?.url) {
    throw new Error('图片临时上传失败');
  }

  return {
    imageUrl: uploaded.url,
    pictureId: uploaded.id,
  };
}
