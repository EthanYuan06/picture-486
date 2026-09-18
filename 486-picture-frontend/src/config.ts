
/**
 * API Configuration
 *
 * Vite 环境变量在构建时注入：
 * 1. 默认使用相对路径，生产环境交给 Nginx 反向代理
 * 2. 开发环境也优先使用相对路径，再由 vite.config.ts 中的 proxy 转发到本地服务
 */

const DEFAULT_API_BASE_URL = '/api';
const DEFAULT_AI_API_BASE_URL = '/ai/api';

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function buildApiRoute(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  DEFAULT_API_BASE_URL
);
export const AI_API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_AI_API_BASE_URL,
  DEFAULT_AI_API_BASE_URL
);

// 集中管理所有 API 端点
export const API_ROUTES = {
  LOGIN: buildApiRoute(API_BASE_URL, '/user/login'),
  REGISTER: buildApiRoute(API_BASE_URL, '/user/register'),
  RESET_PASSWORD: buildApiRoute(API_BASE_URL, '/user/reset'),
  GET_LOGIN: buildApiRoute(API_BASE_URL, '/user/get/login'),
  LOGOUT: buildApiRoute(API_BASE_URL, '/user/logout'),
  USER_GET_VO: buildApiRoute(API_BASE_URL, '/user/get/vo'),
  USER_GET: buildApiRoute(API_BASE_URL, '/user/get'),
  USER_UPDATE: buildApiRoute(API_BASE_URL, '/user/update'),
  USER_DELETE: buildApiRoute(API_BASE_URL, '/user/delete'),
  USER_LIST_PAGE_VO: buildApiRoute(API_BASE_URL, '/user/list/page/vo'),
  USER_AVATAR_UPLOAD: buildApiRoute(API_BASE_URL, '/user/avatar/upload'),

  // Picture
  PICTURE_LIST_PAGE: buildApiRoute(API_BASE_URL, '/picture/list/page'),
  PICTURE_LIST_PAGE_VO: buildApiRoute(API_BASE_URL, '/picture/list/page/vo'),
  PICTURE_GET: buildApiRoute(API_BASE_URL, '/picture/get'),
  PICTURE_GET_VO: buildApiRoute(API_BASE_URL, '/picture/get/vo'),
  PICTURE_REVIEW: buildApiRoute(API_BASE_URL, '/picture/review'),
  PICTURE_REVIEW_BATCH: buildApiRoute(API_BASE_URL, '/picture/review/batch'),
  PICTURE_DELETE: buildApiRoute(API_BASE_URL, '/picture/delete'),
  PICTURE_DELETE_BATCH: buildApiRoute(API_BASE_URL, '/picture/delete/batch'),
  PICTURE_TAG_CATEGORY: buildApiRoute(API_BASE_URL, '/picture/tag_category'),
  PICTURE_UPLOAD: buildApiRoute(API_BASE_URL, '/picture/upload'),
  PICTURE_UPLOAD_COVER: buildApiRoute(API_BASE_URL, '/picture/upload/cover'),
  PICTURE_UPLOAD_BATCH: buildApiRoute(API_BASE_URL, '/picture/upload/batch'),
  PICTURE_EDIT: buildApiRoute(API_BASE_URL, '/picture/edit'),
  PICTURE_EDIT_BATCH: buildApiRoute(API_BASE_URL, '/picture/edit/batch'),

  // Space
  SPACE_ADD: buildApiRoute(API_BASE_URL, '/space/add'),
  SPACE_UPDATE: buildApiRoute(API_BASE_URL, '/space/update'),
  SPACE_DELETE: buildApiRoute(API_BASE_URL, '/space/delete'),
  SPACE_EDIT: buildApiRoute(API_BASE_URL, '/space/edit'),
  SPACE_LIST_PAGE: buildApiRoute(API_BASE_URL, '/space/list/page'),
  SPACE_LIST_PAGE_VO: buildApiRoute(API_BASE_URL, '/space/list/page/vo'),
  SPACE_GET: buildApiRoute(API_BASE_URL, '/space/get'),
  SPACE_GET_VO: buildApiRoute(API_BASE_URL, '/space/get/vo'),
  SPACE_LIST_LEVEL: buildApiRoute(API_BASE_URL, '/space/list/level'),

  // Space Analyze
  SPACE_ANALYZE_USAGE: buildApiRoute(API_BASE_URL, '/space/analyze/usage'),
  SPACE_ANALYZE_CATEGORY: buildApiRoute(API_BASE_URL, '/space/analyze/category'),
  SPACE_ANALYZE_TAG: buildApiRoute(API_BASE_URL, '/space/analyze/tag'),
  SPACE_ANALYZE_SIZE: buildApiRoute(API_BASE_URL, '/space/analyze/size'),
  SPACE_ANALYZE_USER: buildApiRoute(API_BASE_URL, '/space/analyze/user'),

  // Space User
  SPACE_USER_ADD: buildApiRoute(API_BASE_URL, '/spaceUser/add'),
  SPACE_USER_DELETE: buildApiRoute(API_BASE_URL, '/spaceUser/delete'),
  SPACE_USER_GET_VO: buildApiRoute(API_BASE_URL, '/spaceUser/get/vo'),
  SPACE_USER_LIST: buildApiRoute(API_BASE_URL, '/spaceUser/list'),
  SPACE_USER_EDIT: buildApiRoute(API_BASE_URL, '/spaceUser/edit'),
  SPACE_USER_LIST_ME: buildApiRoute(API_BASE_URL, '/spaceUser/list/me'),

  // Message
  MESSAGE_SEND: buildApiRoute(API_BASE_URL, '/message/send'),
  MESSAGE_LIST_PAGE_VO: buildApiRoute(API_BASE_URL, '/message/list/page/vo'),
  MESSAGE_UNREAD_COUNT: buildApiRoute(API_BASE_URL, '/message/unread/count'),
  MESSAGE_READ: buildApiRoute(API_BASE_URL, '/message/read'),
  MESSAGE_READ_ALL: buildApiRoute(API_BASE_URL, '/message/read/all'),

  // AI Assistant
  AI_CREATE_THREAD: buildApiRoute(AI_API_BASE_URL, '/create-thread'),
  AI_CHECK_THREAD: buildApiRoute(AI_API_BASE_URL, '/check-thread'),
  AI_DELETE_THREAD: buildApiRoute(AI_API_BASE_URL, '/delete-thread'),
  AI_COS_PRESIGN: buildApiRoute(AI_API_BASE_URL, '/cos/presign'),
  CHAT: buildApiRoute(AI_API_BASE_URL, '/chat'),
  CHAT_STREAM: buildApiRoute(AI_API_BASE_URL, '/chat/stream'),
  CHAT_STREAM_RESUME: buildApiRoute(AI_API_BASE_URL, '/chat/stream'),
};
