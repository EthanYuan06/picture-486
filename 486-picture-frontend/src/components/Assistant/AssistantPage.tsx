import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  ImagePlus,
  Loader2,
  Menu,
  MessageSquarePlus,
  SendHorizonal,
  Trash2,
  X,
} from 'lucide-react';
import {
  checkAssistantThread,
  createAssistantThread,
  deleteAssistantThread,
  streamAssistantChatMessage,
  uploadAssistantImageToCos,
} from '../../services/assistant';
import { continueHitlUpload } from '../../services/hitlUpload';
import { useToastStore } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/auth';
import { useHitlUploadStore } from '../../stores/hitlUpload';
import { useThemeStore } from '../../stores/theme';
import type {
  AssistantAttachment,
  AssistantChatData,
  AssistantMessage,
  AssistantSession,
} from '../../types/assistant';
import type { HitlUploadForm } from '../../types/hitlUpload';
import { HITL_CONFIRM_TIMEOUT_MS, normalizeHitlForm } from '../../utils/hitlUpload';

const SESSION_STORAGE_KEY = 'subarupic:assistant:sessions';
const ACTIVE_SESSION_STORAGE_KEY = 'subarupic:assistant:activeSessionId';

interface AssistantResumeNavigationState {
  hitlResume?: {
    requestId: string;
    threadId: string;
    userId: string;
    requestSpaceId: number | null;
    sourceSessionId?: string | null;
    sourceMessageId?: string | null;
    modifiedData: HitlUploadForm | null;
  };
}

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const extractPlainText = (content: string): string =>
  content
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\((.*?)\)/g, '$1')
    .replace(/[#>*`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pickStringField = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const extractAssistantImages = (data: Record<string, unknown>): AssistantAttachment[] => {
  const rawImages = [data.images, data.image_urls, data.imageUrls].find((value) =>
    Array.isArray(value)
  );

  if (!Array.isArray(rawImages)) {
    return [];
  }

  const seen = new Set<string>();

  return rawImages.reduce<AssistantAttachment[]>((attachments, item, index) => {
    let url = '';
    let name = '';

    if (typeof item === 'string') {
      url = item.trim();
    } else if (typeof item === 'object' && item !== null) {
      url = pickStringField(item as Record<string, unknown>, [
        'url',
        'imageUrl',
        'image_url',
        'src',
      ]);
      name = pickStringField(item as Record<string, unknown>, [
        'name',
        'title',
        'filename',
        'file_name',
      ]);
    }

    if (!/^https?:\/\//i.test(url) || seen.has(url)) {
      return attachments;
    }

    seen.add(url);
    attachments.push({
      id: createId(),
      name: name || `AI 返回图片 ${index + 1}`,
      url,
    });
    return attachments;
  }, []);
};

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:$|[?#])/i;

const normalizeClipboardUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return '';
  }

  return '';
};

const extractImageUrlFromHtml = (html: string): string => {
  if (!html.trim()) {
    return '';
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const image = doc.querySelector('img');
  const src = image?.getAttribute('src') ?? '';
  return normalizeClipboardUrl(src);
};

const extractImageUrlFromText = (value: string): string => {
  const normalized = value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));

  if (!normalized) {
    return '';
  }

  const url = normalizeClipboardUrl(normalized);
  if (!url) {
    return '';
  }

  return /^data:image\//i.test(url) || IMAGE_URL_PATTERN.test(url) ? url : '';
};

const inferImageName = (url: string): string => {
  if (/^data:image\//i.test(url)) {
    return 'online-image';
  }

  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    if (!lastSegment) {
      return 'online-image';
    }
    const decoded = decodeURIComponent(lastSegment);
    return decoded || 'online-image';
  } catch {
    return 'online-image';
  }
};

const buildWelcomeMessage = (): AssistantMessage => ({
  id: createId(),
  role: 'assistant',
  createdAt: Date.now(),
  attachments: [],
  content: [
    '### 昴云 - 智能助手✨',
    '这里是你的专属相册 AI 搭子！能干超多事：',
    '',
    '- 文字指令搜图，想找啥图一句话搞定',
    '- 发图自动推送风格相似美图',
    '- 本地 / 网络图片一键上传，存私人相册或公共图库',
    '- 风景图生成赏析文案、动漫截图秒溯源番剧',
    '- 任意图片一键产出配图文案，发圈不愁',
    '',
    '无聊也能随便闲聊，想问啥我都尽力答复～',
  ].join('\n'),
});

const buildFreshSession = (threadId: string, sessionId?: string): AssistantSession => {
  const welcomeMessage = buildWelcomeMessage();
  return {
    id: sessionId ?? createId(),
    threadId,
    title: '新会话',
    preview: '准备开始新的 AI 对话',
    updatedAt: welcomeMessage.createdAt,
    messages: [welcomeMessage],
  };
};

const parseStoredSessions = (): AssistantSession[] => {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AssistantSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatAssistantReply = (data: Record<string, unknown>): string => {
  const reply =
    typeof data.reply === 'string' && data.reply.trim()
      ? data.reply.trim()
      : 'AI 服务未返回可展示的回复内容。';

  const uploadConfirmation =
    typeof data.upload_confirmation === 'object' && data.upload_confirmation !== null
      ? (data.upload_confirmation as Record<string, unknown>)
      : null;

  if (!uploadConfirmation) {
    return reply;
  }

  const tags = Array.isArray(uploadConfirmation.tags)
    ? uploadConfirmation.tags.join('、')
    : '';
  const lines = [
    reply,
    '',
    '#### 上传确认数据',
    `- 名称：${String(uploadConfirmation.name || '-')}`,
    `- 分类：${String(uploadConfirmation.category || '-')}`,
    `- 标签：${tags || '-'}`,
    `- 位置：${
      uploadConfirmation.space_id === null || uploadConfirmation.space_id === undefined
        ? '公共图库'
        : `个人相册 #${String(uploadConfirmation.space_id)}`
    }`,
  ];

  if (typeof uploadConfirmation.introduction === 'string') {
    lines.push('', '#### 简介', String(uploadConfirmation.introduction));
  }

  return lines.join('\n');
};

const buildHitlPendingPayload = (
  data: AssistantChatData,
  fallbackImageUrl: string,
  userQuery: string,
  threadId: string,
  userId: string,
  requestSpaceId: number | null,
  sourceSessionId?: string | null,
  sourceMessageId?: string | null
): {
  threadId: string;
  userId: string;
  requestSpaceId: number | null;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
  imageUrl: string;
  userQuery: string;
  originalConfirmation: NonNullable<AssistantChatData['upload_confirmation']>;
  draftForm: ReturnType<typeof normalizeHitlForm>;
  startedAt: number;
  expiresAt: number;
} | null => {
  if (!data.upload_confirmation) {
    return null;
  }

  const originalConfirmation = {
    ...data.upload_confirmation,
    ...normalizeHitlForm(data.upload_confirmation),
    image_url:
      data.upload_confirmation.image_url ||
      (typeof data.image_url === 'string' ? data.image_url : fallbackImageUrl),
  };
  const now = Date.now();

  return {
    threadId,
    userId,
    requestSpaceId,
    sourceSessionId: sourceSessionId ?? null,
    sourceMessageId: sourceMessageId ?? null,
    imageUrl: originalConfirmation.image_url || fallbackImageUrl,
    userQuery,
    originalConfirmation,
    draftForm: normalizeHitlForm(originalConfirmation),
    startedAt: now,
    expiresAt: now + HITL_CONFIRM_TIMEOUT_MS,
  };
};

const RobotGlyph: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span
    aria-hidden="true"
    className={`relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] text-white shadow-[0_14px_30px_rgba(107,70,193,0.28)] ${
      compact ? 'h-9 w-9' : 'h-10 w-10'
    }`}
  >
    <Bot className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#D6BCFA]" />
  </span>
);

const AssistantPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const userInfo = useAuthStore((state) => state.userInfo);
  const setPendingSession = useHitlUploadStore((state) => state.setPendingSession);
  const clearHitlSession = useHitlUploadStore((state) => state.clearSession);
  const theme = useThemeStore((state) => state.theme);
  const addToast = useToastStore((state) => state.addToast);
  const isDarkTheme = theme === 'dark';

  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [draft, setDraft] = useState('');
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null);
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [draftImagePreview, setDraftImagePreview] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AssistantAttachment | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledResumeRequestIdsRef = useRef<Set<string>>(new Set());

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );
  const pendingResumeThreadId = useMemo(() => {
    const navigationState = (location.state ?? null) as AssistantResumeNavigationState | null;
    return navigationState?.hitlResume?.threadId ?? '';
  }, [location.state]);

  const persistSessions = useCallback((nextSessions: AssistantSession[], nextActiveId: string) => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSessions));
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, nextActiveId);
  }, []);

  const updateSession = useCallback(
    (sessionId: string, updater: (session: AssistantSession) => AssistantSession) => {
      setSessions((current) => {
        const nextSessions = current.map((session) =>
          session.id === sessionId ? updater(session) : session
        );
        persistSessions(nextSessions, activeSessionId || sessionId);
        return nextSessions;
      });
    },
    [activeSessionId, persistSessions]
  );

  const ensureSessionForThread = useCallback(
    (threadId: string): AssistantSession => {
      let ensuredSession: AssistantSession | null = null;

      setSessions((current) => {
        const existingSession = current.find((session) => session.threadId === threadId);
        if (existingSession) {
          ensuredSession = existingSession;
          return current;
        }

        const nextSession = buildFreshSession(threadId);
        ensuredSession = nextSession;
        const nextSessions = [nextSession, ...current];
        persistSessions(nextSessions, nextSession.id);
        return nextSessions;
      });

      const nextSession = ensuredSession ?? buildFreshSession(threadId);
      setActiveSessionId(nextSession.id);
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, nextSession.id);
      return nextSession;
    },
    [persistSessions]
  );

  const clearDraftImage = useCallback(() => {
    if (draftImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(draftImagePreview);
    }
    setDraftImageFile(null);
    setDraftImageUrl('');
    setDraftImagePreview('');
  }, [draftImagePreview]);

  const applyDraftImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        addToast('仅支持上传图片文件', 'error');
        return;
      }
      clearDraftImage();
      setDraftImageFile(file);
      setDraftImagePreview(URL.createObjectURL(file));
    },
    [addToast, clearDraftImage]
  );

  const applyDraftImageUrl = useCallback(
    (url: string) => {
      const normalizedUrl = normalizeClipboardUrl(url);
      if (!normalizedUrl) {
        return;
      }
      clearDraftImage();
      setDraftImageUrl(normalizedUrl);
      setDraftImagePreview(normalizedUrl);
    },
    [clearDraftImage]
  );

  const createSessionTitle = useCallback((value: string): string => {
    const plainText = extractPlainText(value);
    return plainText ? plainText.slice(0, 18) : '图片分析会话';
  }, []);

  const createSessionPreview = useCallback((value: string, hasImage: boolean): string => {
    const plainText = extractPlainText(value);
    if (plainText) {
      return plainText.slice(0, 36);
    }
    return hasImage ? '发送了一张图片' : '等待继续输入';
  }, []);

  const ensureSessionThread = useCallback(
    async (session: AssistantSession): Promise<AssistantSession> => {
      try {
        const valid = await checkAssistantThread(session.threadId);
        if (valid) {
          return session;
        }
      } catch (error) {
        console.error('Check assistant thread failed', error);
      }

      const nextThreadId = await createAssistantThread();
      const resetMessage: AssistantMessage = {
        id: createId(),
        role: 'assistant',
        createdAt: Date.now(),
        attachments: [],
        content: [
          '### 会话已重建',
          '检测到原会话在 AI 服务中已失效，已根据接口文档重新创建新的 `thread_id`。',
          '',
          '你现在可以继续发起对话。',
        ].join('\n'),
      };
      const nextSession: AssistantSession = {
        ...buildFreshSession(nextThreadId, session.id),
        title: session.title === '新会话' ? '新会话' : session.title,
        preview: '会话已重新创建',
        messages: [buildWelcomeMessage(), resetMessage],
      };

      setSessions((current) => {
        const nextSessions = current.map((item) =>
          item.id === session.id ? nextSession : item
        );
        persistSessions(nextSessions, session.id);
        return nextSessions;
      });

      addToast('检测到会话失效，已重新创建新会话', 'warning');
      return nextSession;
    },
    [addToast, persistSessions]
  );

  const bootstrapSessions = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const storedSessions = parseStoredSessions();
      const storedActiveId =
        window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || storedSessions[0]?.id || '';

      if (storedSessions.length === 0) {
        const threadId = pendingResumeThreadId || (await createAssistantThread());
        const freshSession = buildFreshSession(threadId);
        setSessions([freshSession]);
        setActiveSessionId(freshSession.id);
        persistSessions([freshSession], freshSession.id);
        return;
      }

      setSessions(storedSessions);
      setActiveSessionId(storedActiveId);
    } catch (error) {
      console.error('Bootstrap assistant sessions failed', error);
      addToast('AI 会话初始化失败，请稍后重试', 'error');
    } finally {
      setIsBootstrapping(false);
    }
  }, [addToast, pendingResumeThreadId, persistSessions]);

  useEffect(() => {
    void bootstrapSessions();
  }, [bootstrapSessions]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(media.matches);
    updateMotionPreference();
    media.addEventListener('change', updateMotionPreference);
    return () => media.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!activeSession) {
      return;
    }
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [activeSession, isSending, prefersReducedMotion]);

  useEffect(() => {
    const navigationState = (location.state ?? null) as AssistantResumeNavigationState | null;
    const resumeTask = navigationState?.hitlResume;

    if (isBootstrapping || !resumeTask) {
      return;
    }

    if (handledResumeRequestIdsRef.current.has(resumeTask.requestId)) {
      return;
    }
    handledResumeRequestIdsRef.current.add(resumeTask.requestId);

    navigate('/dashboard/assistant', { replace: true, state: null });

    const targetSession =
      resumeTask.sourceSessionId && sessions.some((session) => session.id === resumeTask.sourceSessionId)
        ? sessions.find((session) => session.id === resumeTask.sourceSessionId) ??
          ensureSessionForThread(resumeTask.threadId)
        : ensureSessionForThread(resumeTask.threadId);
    const existingMessageId = resumeTask.sourceMessageId ?? '';
    const hasExistingMessage = targetSession.messages.some(
      (message) => message.id === existingMessageId
    );
    const assistantMessageId = hasExistingMessage ? existingMessageId : createId();
    const startedAt = Date.now();
    const placeholderMessage: AssistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '正在完成上传，请稍候...',
      createdAt: startedAt,
      attachments: [],
      status: 'streaming',
    };

    updateSession(targetSession.id, (session) => ({
      ...session,
      updatedAt: startedAt,
      preview: '正在完成上传...',
      messages: hasExistingMessage
        ? session.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: placeholderMessage.content,
                  createdAt: startedAt,
                  status: placeholderMessage.status,
                }
              : message
          )
        : [...session.messages, placeholderMessage],
    }));

    void continueHitlUpload({
      thread_id: resumeTask.threadId,
      query: '',
      user_id: resumeTask.userId,
      space_id: resumeTask.requestSpaceId,
      user_confirmed: true,
      modified_data: resumeTask.modifiedData,
    })
      .then((chatData) => {
        const reply =
          typeof chatData.reply === 'string' && chatData.reply.trim()
            ? chatData.reply.trim()
            : '图片上传流程已完成';
        const status: AssistantMessage['status'] =
          reply.includes('确认超时') ? 'error' : 'done';
        const updatedAt = Date.now();

        updateSession(targetSession.id, (session) => ({
          ...session,
          updatedAt,
          preview: extractPlainText(reply).slice(0, 36) || session.preview,
          messages: session.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: reply,
                  createdAt: updatedAt,
                  status,
                }
              : message
          ),
        }));

        if (reply.includes('确认超时')) {
          addToast('⏰ 确认超时，请重新上传', 'error');
        }
        clearHitlSession();
      })
      .catch((error: unknown) => {
        console.error('Resume HITL upload failed', error);
        const message =
          error instanceof Error && error.message ? error.message : '确认上传失败';
        const updatedAt = Date.now();

        updateSession(targetSession.id, (session) => ({
          ...session,
          updatedAt,
          preview: extractPlainText(message).slice(0, 36) || session.preview,
          messages: session.messages.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: message,
                  createdAt: updatedAt,
                  status: 'error',
                }
              : item
          ),
        }));
        addToast(message, 'error');
      });
  }, [
    addToast,
    clearHitlSession,
    ensureSessionForThread,
    isBootstrapping,
    location.state,
    navigate,
    sessions,
    updateSession,
  ]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (draftImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(draftImagePreview);
      }
    };
  }, [draftImagePreview]);

  useEffect(() => {
    if (!previewAttachment) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewAttachment(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAttachment]);

  const handleCreateSession = useCallback(async () => {
    try {
      const threadId = await createAssistantThread();
      const session = buildFreshSession(threadId);
      setSessions((current) => {
        const nextSessions = [session, ...current];
        persistSessions(nextSessions, session.id);
        return nextSessions;
      });
      setActiveSessionId(session.id);
      setDraft('');
      clearDraftImage();
      setIsSidebarOpen(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    } catch (error) {
      console.error('Create assistant session failed', error);
      addToast('新建会话失败', 'error');
    }
  }, [addToast, clearDraftImage, persistSessions]);

  const handleActivateSession = useCallback(
    async (sessionId: string) => {
      const targetSession = sessions.find((session) => session.id === sessionId);
      if (!targetSession) {
        return;
      }

      setActiveSessionId(sessionId);
      setIsSidebarOpen(false);
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);

      if (sessionId === activeSessionId) {
        return;
      }

      try {
        await ensureSessionThread(targetSession);
      } catch (error) {
        console.error('Activate assistant session failed', error);
        addToast('会话校验失败，请稍后重试', 'error');
      }
    },
    [activeSessionId, addToast, ensureSessionThread, sessions]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) {
        return;
      }

      try {
        await deleteAssistantThread(target.threadId);
      } catch (error) {
        console.error('Delete assistant thread failed', error);
      }

      const remainingSessions = sessions.filter((session) => session.id !== sessionId);
      const nextActiveId =
        sessionId === activeSessionId ? remainingSessions[0]?.id || '' : activeSessionId;
      setSessions(remainingSessions);
      setActiveSessionId(nextActiveId);
      if (!nextActiveId) {
        setDraft('');
        clearDraftImage();
      }
      persistSessions(remainingSessions, nextActiveId);
    },
    [activeSessionId, clearDraftImage, persistSessions, sessions]
  );

  const handleSelectImage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      applyDraftImageFile(file);
      event.target.value = '';
    },
    [applyDraftImageFile]
  );

  const handleComposerPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardItems = Array.from(event.clipboardData.items);
      const imageItem = clipboardItems.find(
        (item) => item.kind === 'file' && item.type.startsWith('image/')
      );
      const imageFile = imageItem?.getAsFile() ?? null;
      if (imageFile) {
        event.preventDefault();
        applyDraftImageFile(imageFile);
        return;
      }

      const htmlImageUrl = extractImageUrlFromHtml(event.clipboardData.getData('text/html'));
      if (htmlImageUrl) {
        event.preventDefault();
        applyDraftImageUrl(htmlImageUrl);
        return;
      }

      const plainImageUrl =
        extractImageUrlFromText(event.clipboardData.getData('text/uri-list')) ||
        extractImageUrlFromText(event.clipboardData.getData('text/plain'));
      if (plainImageUrl) {
        event.preventDefault();
        applyDraftImageUrl(plainImageUrl);
      }
    },
    [applyDraftImageFile, applyDraftImageUrl]
  );

  const handleSend = useCallback(async () => {
    if (!activeSession || isSending) {
      return;
    }

    if (!userInfo?.id) {
      addToast('登录状态已失效，请重新登录', 'error');
      return;
    }

    const trimmedDraft = draft.trim();
    if (!trimmedDraft && !draftImageFile && !draftImageUrl) {
      return;
    }

    setIsSending(true);
    setIsSidebarOpen(false);
    setDraft('');
    clearDraftImage();

    try {
      const usableSession = activeSession;
      let imageUrl = '';
      let userAttachments: AssistantAttachment[] = [];
      let assistantMessageId = '';
      const hasDraftImage = !!(draftImageFile || draftImageUrl);

      if (draftImageFile) {
        const uploaded = await uploadAssistantImageToCos(draftImageFile);
        imageUrl = uploaded.imageUrl;
        userAttachments = [
          {
            id: createId(),
            name: draftImageFile.name,
            url: uploaded.imageUrl,
          },
        ];
      } else if (draftImageUrl) {
        imageUrl = draftImageUrl;
        userAttachments = [
          {
            id: createId(),
            name: inferImageName(draftImageUrl),
            url: draftImageUrl,
          },
        ];
      }

      const messageText = trimmedDraft || (hasDraftImage ? '请帮我分析这张图片' : '');
      const userId = String(userInfo.id);
      const requestSpaceId = null;
      const now = Date.now();
      const userMessage: AssistantMessage = {
        id: createId(),
        role: 'user',
        content: messageText,
        createdAt: now,
        attachments: userAttachments,
      };

      const nextTitle =
        usableSession.title === '新会话'
          ? createSessionTitle(messageText)
          : usableSession.title;
      const nextPreview = createSessionPreview(messageText, hasDraftImage);
      const assistantCreatedAt = Date.now();
      assistantMessageId = createId();
      const assistantPlaceholder: AssistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '正在思考中...',
        createdAt: assistantCreatedAt,
        attachments: [],
        status: 'streaming',
      };

      updateSession(usableSession.id, (session) => ({
        ...session,
        title: nextTitle,
        preview: nextPreview,
        updatedAt: assistantCreatedAt,
        messages: [...session.messages, userMessage, assistantPlaceholder],
      }));
      setStreamingMessageId(assistantMessageId);

      let streamedContent = '';
      let streamedAttachments: AssistantAttachment[] = [];
      let interrupted = false;

      const replaceAssistantMessage = (updater: (message: AssistantMessage) => AssistantMessage) => {
        updateSession(usableSession.id, (session) => ({
          ...session,
          messages: session.messages.map((message) =>
            message.id === assistantMessageId ? updater(message) : message
          ),
        }));
      };

      const finalizeAssistantMessage = (
        content: string,
        attachments: AssistantAttachment[],
        status: AssistantMessage['status'] = 'done'
      ) => {
        const updatedAt = Date.now();
        replaceAssistantMessage((message) => ({
          ...message,
          content,
          attachments,
          status,
          createdAt: updatedAt,
        }));
        updateSession(usableSession.id, (session) => ({
          ...session,
          preview: extractPlainText(content).slice(0, 36) || nextPreview,
          updatedAt,
        }));
      };

      const finalChatData = await streamAssistantChatMessage({
        thread_id: usableSession.threadId,
        query: messageText,
        user_id: userId,
        space_id: requestSpaceId,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      }, {
        onMessage: (chunk) => {
          streamedContent += chunk;
          replaceAssistantMessage((message) => ({
            ...message,
            content: streamedContent,
            status: 'streaming',
          }));
        },
        onImages: (images) => {
          streamedAttachments = extractAssistantImages({ images });
          replaceAssistantMessage((message) => ({
            ...message,
            attachments: streamedAttachments,
          }));
        },
        onInterrupt: (chatData) => {
          interrupted = true;
          const confirmationPayload = buildHitlPendingPayload(
            chatData,
            imageUrl,
            messageText,
            usableSession.threadId,
            userId,
            requestSpaceId,
            usableSession.id,
            assistantMessageId
          );

          finalizeAssistantMessage(
            formatAssistantReply(chatData),
            extractAssistantImages(chatData),
            'done'
          );

          if (confirmationPayload) {
            setPendingSession(confirmationPayload);
            navigate('/dashboard/upload-confirm');
          }
        },
        onDone: (chatData) => {
          if (!chatData) {
            return;
          }

          const finalContent = streamedContent || formatAssistantReply(chatData);
          const finalAttachments =
            streamedAttachments.length > 0
              ? streamedAttachments
              : extractAssistantImages(chatData);

          finalizeAssistantMessage(finalContent, finalAttachments, 'done');
        },
        onError: (message) => {
          throw new Error(message);
        },
      });

      if (!interrupted) {
        const fallbackData = finalChatData ?? {
          reply: streamedContent || 'AI 服务未返回可展示的回复内容。',
        };
        const confirmationPayload = buildHitlPendingPayload(
          fallbackData,
          imageUrl,
          messageText,
          usableSession.threadId,
          userId,
          requestSpaceId,
          usableSession.id,
          assistantMessageId
        );

        if (confirmationPayload) {
          setPendingSession(confirmationPayload);
          navigate('/dashboard/upload-confirm');
          return;
        }

        const finalContent = streamedContent || formatAssistantReply(fallbackData);
        const finalAttachments =
          streamedAttachments.length > 0
            ? streamedAttachments
            : extractAssistantImages(fallbackData);

        finalizeAssistantMessage(finalContent, finalAttachments, 'done');
      }

      window.setTimeout(() => textareaRef.current?.focus(), 0);
    } catch (error) {
      console.error('Send assistant message failed', error);
      const message =
        error instanceof Error && error.message ? error.message : '发送消息失败';
      if (streamingMessageId) {
        updateSession(activeSession.id, (session) => ({
          ...session,
          messages: session.messages.map((item) =>
            item.id === streamingMessageId
              ? {
                  ...item,
                  content: message,
                  status: 'error',
                }
              : item
          ),
        }));
      }
      addToast(message, 'error');
    } finally {
      setStreamingMessageId('');
      setIsSending(false);
    }
  }, [
    activeSession,
    addToast,
    clearDraftImage,
    createSessionPreview,
    createSessionTitle,
    draft,
    draftImageFile,
    draftImageUrl,
    isSending,
    navigate,
    setPendingSession,
    streamingMessageId,
    updateSession,
    userInfo?.id,
  ]);

  const draftImageName = useMemo(() => {
    if (draftImageFile) {
      return draftImageFile.name;
    }
    if (draftImageUrl) {
      return inferImageName(draftImageUrl);
    }
    return '待上传图片';
  }, [draftImageFile, draftImageUrl]);

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  if (isBootstrapping) {
    return (
      <div className="flex h-full items-center justify-center rounded-[30px] border border-white/10 bg-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3 text-sm text-white/75">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在初始化 AI 会话...
        </div>
      </div>
    );
  }

  const shellClass = isDarkTheme
    ? 'border-white/10 bg-[#121212] text-white shadow-[0_24px_90px_rgba(8,8,18,0.48)]'
    : 'border-slate-200/90 bg-[#F7F5FF] text-slate-900 shadow-[0_24px_90px_rgba(148,163,184,0.2)]';
  const shellGlowClass = isDarkTheme
    ? 'bg-[radial-gradient(circle_at_top,_rgba(159,122,234,0.18),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(107,70,193,0.16),_transparent_32%)]'
    : 'bg-[radial-gradient(circle_at_top,_rgba(159,122,234,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(99,179,237,0.12),_transparent_28%)]';
  const overlayClass = isDarkTheme ? 'bg-black/50' : 'bg-slate-900/20';
  const sidebarClass = isDarkTheme
    ? 'border-white/10 bg-[#151515]/95'
    : 'border-slate-200/90 bg-white/88 shadow-[18px_0_40px_rgba(148,163,184,0.12)]';
  const topHeaderClass = isDarkTheme
    ? 'border-white/10 bg-[#121212]/80'
    : 'border-slate-200/80 bg-white/72';
  const mobileSidebarButtonClass = isDarkTheme
    ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
    : 'border-slate-200 bg-white/88 text-slate-700 hover:bg-slate-50';
  const assistantIconClass = isDarkTheme
    ? 'border border-white/10 bg-white/[0.08] text-[#D6BCFA] shadow-[0_0_32px_rgba(107,70,193,0.22)]'
    : 'border border-[#D8B4FE]/60 bg-white text-[#6B46C1] shadow-[0_12px_32px_rgba(196,181,253,0.34)]';
  const assistantBubbleClass = isDarkTheme
    ? 'rounded-bl-md border border-white/12 bg-white/[0.07] text-[#E2E8F0] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_36px_rgba(107,70,193,0.16)]'
    : 'rounded-bl-md border border-white/80 bg-white/78 text-slate-700 shadow-[0_18px_40px_rgba(148,163,184,0.16),0_0_0_1px_rgba(255,255,255,0.8)]';
  const composerWrapClass = isDarkTheme
    ? 'border-t border-white/10 bg-[#121212]/90'
    : 'border-t border-slate-200/80 bg-white/72';

  return (
    <section className={`relative h-full min-h-0 overflow-hidden rounded-[30px] border ${shellClass}`}>
      <div className="assistant-particle-field pointer-events-none absolute inset-0">
        {Array.from({ length: 14 }).map((_, index) => (
          <span key={index} className={`assistant-particle assistant-particle-${index + 1}`} />
        ))}
      </div>
      <div className={`pointer-events-none absolute inset-0 ${shellGlowClass}`} />

      <div className="relative flex h-full">
        {isSidebarOpen ? (
          <button
            type="button"
            className={`absolute inset-0 z-30 backdrop-blur-sm lg:hidden ${overlayClass}`}
            onClick={() => setIsSidebarOpen(false)}
            aria-label="关闭侧边栏"
          />
        ) : null}

        <aside
          className={`absolute inset-y-0 left-0 z-40 flex w-[224px] flex-col border-r backdrop-blur-xl transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0 ${sidebarClass} ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`flex items-center justify-between border-b px-3 py-3 ${isDarkTheme ? 'border-white/10' : 'border-slate-200/80'}`}>
            <div className="flex items-center gap-3">
              <RobotGlyph compact />
              <div className={isDarkTheme ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-slate-900'}>
                昴云 - 智能助手
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateSession()}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors duration-200 ${
                isDarkTheme
                  ? 'border-white/10 bg-white/5 text-[#D6BCFA] hover:bg-white/10 hover:text-white'
                  : 'border-slate-200 bg-[#F5F3FF] text-[#6B46C1] hover:bg-[#EDE9FE] hover:text-[#4C1D95]'
              }`}
              aria-label="新建会话"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2.5">
            {sessions.map((session) => {
              const isActive = session.id === activeSession.id;
              return (
                <div
                  key={session.id}
                  className={`group mb-1 flex items-center gap-1 rounded-2xl px-2 py-1.5 transition-colors ${
                    isActive
                      ? isDarkTheme
                        ? 'bg-white/[0.08]'
                        : 'bg-slate-900/[0.05]'
                      : isDarkTheme
                        ? 'hover:bg-white/[0.05]'
                        : 'hover:bg-slate-900/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleActivateSession(session.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-xl py-1 text-left"
                    title={session.title}
                  >
                    <span
                      className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                        isActive
                          ? 'bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] text-white'
                          : isDarkTheme
                            ? 'bg-white/[0.08] text-[#D6BCFA]'
                            : 'bg-slate-900/[0.05] text-[#6B46C1]'
                      }`}
                    >
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <span
                      className={`truncate text-[13px] leading-6 ${
                        isActive
                          ? isDarkTheme
                            ? 'font-medium text-white'
                            : 'font-medium text-slate-900'
                          : isDarkTheme
                            ? 'text-white/80'
                            : 'text-slate-700'
                      }`}
                    >
                      {session.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSession(session.id)}
                    className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition ${
                      isActive
                        ? isDarkTheme
                          ? 'text-white/50 hover:bg-white/10 hover:text-rose-300'
                          : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400'
                        : isDarkTheme
                          ? 'text-white/0 hover:bg-white/10 group-hover:text-white/45 hover:text-rose-300'
                          : 'text-slate-300 hover:bg-rose-500/10 group-hover:text-slate-400 hover:text-rose-400'
                    }`}
                    aria-label={`删除会话 ${session.title}`}
                    title="删除会话"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className={`border-b px-4 py-3 backdrop-blur-xl sm:px-6 ${topHeaderClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors duration-200 lg:hidden ${mobileSidebarButtonClass}`}
                  aria-label="打开会话侧边栏"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h2 className={`truncate text-base font-semibold leading-none sm:text-lg ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    {activeSession ? activeSession.title : '暂无会话'}
                  </h2>
                  <p className={`mt-2 truncate text-xs ${isDarkTheme ? 'text-white/45' : 'text-slate-500'}`}>
                    {activeSession ? `当前线程：\`${activeSession.threadId}\`` : '会话列表为空，请先创建一个新会话。'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeSession ? (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
                  <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-14">
                    {activeSession.messages.map((message) => {
                      const isUser = message.role === 'user';
                      return (
                        <article key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`flex max-w-[92%] items-start gap-3 sm:max-w-[84%] ${
                              isUser
                                ? `relative flex-row-reverse ${
                                    message.attachments.length > 0 ? 'pt-14' : ''
                                  }`
                                : 'flex-row'
                            }`}
                          >
                            <span
                              className={`mt-1 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                                isUser
                                  ? 'overflow-hidden bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] text-white'
                                  : assistantIconClass
                              }`}
                            >
                              {isUser ? (
                                userInfo?.avatarUrl ? (
                                  <img
                                    src={userInfo.avatarUrl}
                                    alt="用户头像"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  '你'
                                )
                              ) : (
                                <Bot className="h-4 w-4" />
                              )}
                            </span>

                            <div
                              className={`min-w-0 rounded-[24px] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.16)] ${
                                isUser
                                  ? 'rounded-br-md bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] text-white'
                                  : `backdrop-blur-md ${assistantBubbleClass}`
                              }`}
                            >
                              <div className={`assistant-markdown text-sm leading-7 ${isUser ? 'assistant-markdown-user' : isDarkTheme ? '' : 'assistant-markdown-light'}`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {message.content}
                                </ReactMarkdown>
                              </div>

                              {message.attachments.length > 0 ? (
                                isUser ? (
                                  <div className="absolute right-[3.25rem] top-0">
                                    {message.attachments.slice(0, 1).map((image) => (
                                      <button
                                        key={image.id}
                                        type="button"
                                        onClick={() => setPreviewAttachment(image)}
                                        className="group relative h-12 w-12 overflow-hidden rounded-xl border border-white/25 bg-white/10 shadow-[0_10px_20px_rgba(76,29,149,0.22)] transition duration-200 hover:border-white/40 hover:bg-white/14"
                                        aria-label={`查看大图 ${image.name}`}
                                      >
                                        <img
                                          src={image.url}
                                          alt={image.name}
                                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                                        />
                                        {message.attachments.length > 1 ? (
                                          <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1 py-0.5 text-[9px] font-medium leading-none text-white">
                                            +{message.attachments.length - 1}
                                          </span>
                                        ) : null}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-4 max-w-[440px]">
                                    <div className="grid grid-cols-3 gap-2.5">
                                      {message.attachments.map((image, index) => (
                                        <button
                                          key={image.id}
                                          type="button"
                                          onClick={() => setPreviewAttachment(image)}
                                          className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border transition duration-200 ${
                                            isDarkTheme
                                              ? 'border-white/10 bg-white/[0.04] hover:border-[#9F7AEA]/50 hover:bg-white/[0.08]'
                                              : 'border-slate-200 bg-white hover:border-[#C4B5FD] hover:shadow-[0_12px_28px_rgba(148,163,184,0.18)]'
                                          }`}
                                          aria-label={`查看大图 ${image.name}`}
                                        >
                                          <img
                                            src={image.url}
                                            alt={image.name}
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                                          />
                                          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent opacity-90" />
                                          <span className="absolute left-2 top-2 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                            {index + 1}
                                          </span>
                                          <span className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[11px] font-medium text-white">
                                            查看大图
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {isSending && !streamingMessageId ? (
                      <article className="flex justify-start">
                        <div className="flex max-w-[92%] items-start gap-3 sm:max-w-[84%]">
                          <span className={`mt-1 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${assistantIconClass}`}>
                            <Bot className="h-4 w-4" />
                          </span>
                          <div className={`rounded-[24px] rounded-bl-md px-4 py-4 backdrop-blur-md ${assistantBubbleClass}`}>
                            <div className={`flex items-center gap-3 text-sm ${isDarkTheme ? 'text-[#E2E8F0]' : 'text-slate-700'}`}>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>正在调用后端接口，请稍候...</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ) : null}

                    <div ref={bottomRef} />
                  </div>
                </div>

                <div className={`px-4 py-3 backdrop-blur-xl sm:px-6 ${composerWrapClass}`}>
                  <div className="mx-auto w-full max-w-4xl">
                    <div className={`rounded-[28px] border p-[1px] ${isDarkTheme ? 'border-white/10 bg-white/[0.04] shadow-[0_18px_48px_rgba(6,6,12,0.35)]' : 'border-slate-200/90 bg-white/70 shadow-[0_18px_48px_rgba(148,163,184,0.18)]'}`}>
                      <div className={`relative rounded-[27px] border border-transparent px-4 py-3 ${isDarkTheme ? 'bg-[#18181B]/95' : 'bg-[#FFFFFF]/96'}`}>
                        {draftImagePreview ? (
                          <div className="mb-3">
                            <div
                              className={`relative h-24 w-24 overflow-hidden rounded-2xl border ${
                                isDarkTheme ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <img
                                src={draftImagePreview}
                                alt={draftImageName}
                                className="h-full w-full object-cover object-center"
                              />
                              <button
                                type="button"
                                onClick={clearDraftImage}
                                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
                                aria-label="移除待发送图片"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <textarea
                          id="assistant-composer"
                          ref={textareaRef}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onPaste={handleComposerPaste}
                          onKeyDown={handleComposerKeyDown}
                          rows={1}
                          placeholder="输入你的问题，或上传一张图片后让 AI 分析。按 Enter 发送，Shift + Enter 换行。"
                          className={`min-h-[96px] w-full resize-none border-0 bg-transparent px-2 pb-14 pt-2 text-sm leading-7 focus:outline-none ${isDarkTheme ? 'text-white placeholder:text-[#94A3B8]' : 'text-slate-900 placeholder:text-slate-400'}`}
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`absolute bottom-4 left-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                            isDarkTheme
                              ? 'border-white/10 bg-white/[0.05] text-[#E2E8F0] hover:bg-white/[0.1]'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                          aria-label="选择图片"
                        >
                          <ImagePlus className="h-4 w-4" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSelectImage}
                        />

                        <button
                          type="button"
                          onClick={() => void handleSend()}
                          disabled={isSending || (!draft.trim() && !draftImageFile && !draftImageUrl)}
                          className="absolute bottom-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6217d7,#7c3aed)] text-white shadow-[0_20px_45px_rgba(98,23,215,0.34)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="发送消息"
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendHorizonal className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="text-center">
                  <div className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    暂无会话
                  </div>
                  <p className={`mt-3 text-sm ${isDarkTheme ? 'text-white/55' : 'text-slate-500'}`}>
                    左侧会话列表为空，点击左上角新建按钮开始新的 AI 对话。
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {previewAttachment ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm"
          onClick={() => setPreviewAttachment(null)}
          role="presentation"
        >
          <div
            className={`relative w-full max-w-5xl overflow-hidden rounded-[28px] border ${
              isDarkTheme
                ? 'border-white/10 bg-[#111114]/96 shadow-[0_28px_80px_rgba(0,0,0,0.52)]'
                : 'border-white/80 bg-white/95 shadow-[0_28px_80px_rgba(15,23,42,0.28)]'
            }`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
          >
            <button
              type="button"
              onClick={() => setPreviewAttachment(null)}
              className={`absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                isDarkTheme
                  ? 'bg-black/45 text-white hover:bg-black/65'
                  : 'bg-slate-900/8 text-slate-700 hover:bg-slate-900/14'
              }`}
              aria-label="关闭图片预览"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex max-h-[85vh] min-h-[320px] items-center justify-center bg-black/10 p-4 sm:p-6">
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-[72vh] w-full rounded-2xl object-contain"
              />
            </div>

            <div
              className={`border-t px-5 py-4 text-sm ${
                isDarkTheme
                  ? 'border-white/10 text-white/78'
                  : 'border-slate-200/80 text-slate-700'
              }`}
            >
              {previewAttachment.name}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default AssistantPage;
