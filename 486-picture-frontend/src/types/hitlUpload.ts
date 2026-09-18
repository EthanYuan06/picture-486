export interface HitlUploadForm {
  name: string;
  introduction: string;
  category: string;
  tags: string[];
  space_id: number | null;
}

export interface HitlUploadConfirmation extends HitlUploadForm {
  image_url?: string;
}

export interface HitlChatData extends Record<string, unknown> {
  reply?: string;
  upload_confirmation?: HitlUploadConfirmation;
  image_url?: string;
  picture_url?: string;
  picture_id?: string | number;
  space_id?: number | null;
}

export interface HitlChatResponse {
  code: number;
  data: HitlChatData;
  message?: string;
}

export interface StartHitlUploadRequest {
  thread_id: string;
  query: string;
  image_url: string;
  user_id: string;
  space_id: number | null;
}

export interface ContinueHitlUploadRequest {
  thread_id: string;
  query: string;
  user_id: string;
  space_id: number | null;
  user_confirmed: boolean;
  modified_data?: HitlUploadForm | null;
}

export type HitlUploadResultStatus = 'success' | 'error' | 'info';

export interface HitlUploadResult {
  status: HitlUploadResultStatus;
  reply: string;
  imageUrl?: string;
  pictureUrl?: string;
  pictureId?: string;
  spaceId?: number | null;
  finishedAt: number;
}
