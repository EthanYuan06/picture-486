import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listSpaceVoByPage } from '../../services/space';
import { startHitlUpload, uploadHitlTempImage } from '../../services/hitlUpload';
import { useAuthStore } from '../../stores/auth';
import { useHitlUploadStore } from '../../stores/hitlUpload';
import { useToastStore } from '../../stores/toastStore';
import type { Space } from '../../types/space';
import { HITL_CONFIRM_TIMEOUT_MS, getRemainingSeconds, normalizeHitlForm } from '../../utils/hitlUpload';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const DEFAULT_QUERY = '请帮我上传到公共图库';
const createThreadId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const HitlUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((state) => state.addToast);
  const userInfo = useAuthStore((state) => state.userInfo);
  const pendingStatus = useHitlUploadStore((state) => state.status);
  const pendingThreadId = useHitlUploadStore((state) => state.threadId);
  const pendingExpiresAt = useHitlUploadStore((state) => state.expiresAt);
  const clearSession = useHitlUploadStore((state) => state.clearSession);
  const setPendingSession = useHitlUploadStore((state) => state.setPendingSession);
  const setResult = useHitlUploadStore((state) => state.setResult);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [spaceMode, setSpaceMode] = useState<'public' | 'private'>('public');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [spaceOptions, setSpaceOptions] = useState<Space[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingSeconds = useMemo(
    () => getRemainingSeconds(pendingExpiresAt),
    [pendingExpiresAt]
  );

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!userInfo?.id) {
      return;
    }

    let active = true;
    setIsLoadingSpaces(true);
    listSpaceVoByPage({
      current: 1,
      pageSize: 100,
      userId: userInfo.id,
    })
      .then((page) => {
        if (!active) {
          return;
        }
        setSpaceOptions(page.records ?? []);
      })
      .catch((error: unknown) => {
        console.error('Load spaces failed', error);
        if (active) {
          addToast('相册列表加载失败，请稍后重试', 'warning');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSpaces(false);
        }
      });

    return () => {
      active = false;
    };
  }, [addToast, userInfo?.id]);

  const handleSelectFile = (file: File | null) => {
    if (!file) {
      return;
    }

    const isSupported =
      ALLOWED_TYPES.includes(file.type) || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    if (!isSupported) {
      addToast('仅支持 JPG、PNG、WEBP 图片', 'error');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      addToast('图片大小不能超过 15MB', 'error');
      return;
    }

    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    handleSelectFile(nextFile);
    event.target.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      addToast('请先选择一张图片', 'warning');
      return;
    }

    if (!userInfo?.id) {
      addToast('登录状态已失效，请重新登录', 'error');
      return;
    }

    if (spaceMode === 'private' && !selectedSpaceId) {
      addToast('请选择目标相册', 'warning');
      return;
    }

    const targetSpaceId =
      spaceMode === 'private' ? Number(selectedSpaceId) || null : null;
    const threadId = createThreadId();
    const userId = String(userInfo.id);

    setIsSubmitting(true);
    try {
      const { imageUrl } = await uploadHitlTempImage(selectedFile, targetSpaceId);
      const chatData = await startHitlUpload({
        thread_id: threadId,
        query: query.trim() || DEFAULT_QUERY,
        image_url: imageUrl,
        user_id: userId,
        space_id: targetSpaceId,
      });

      if (chatData.upload_confirmation) {
        const originalConfirmation = {
          ...chatData.upload_confirmation,
          ...normalizeHitlForm(chatData.upload_confirmation),
          image_url:
            chatData.upload_confirmation.image_url ||
            (typeof chatData.image_url === 'string' ? chatData.image_url : imageUrl),
        };

        const now = Date.now();
        setPendingSession({
          threadId,
          userId,
          requestSpaceId: targetSpaceId,
          imageUrl: originalConfirmation.image_url || imageUrl,
          userQuery: query.trim() || DEFAULT_QUERY,
          originalConfirmation,
          draftForm: normalizeHitlForm(originalConfirmation),
          startedAt: now,
          expiresAt: now + HITL_CONFIRM_TIMEOUT_MS,
        });
        navigate('/dashboard/upload-confirm');
        return;
      }

      setResult({
        status: 'info',
        reply:
          typeof chatData.reply === 'string' && chatData.reply.trim()
            ? chatData.reply
            : 'AI 已处理请求，但未返回待确认内容。',
        imageUrl,
        pictureUrl:
          typeof chatData.picture_url === 'string' ? chatData.picture_url : undefined,
        pictureId:
          chatData.picture_id !== undefined ? String(chatData.picture_id) : undefined,
        spaceId:
          typeof chatData.space_id === 'number' ? chatData.space_id : targetSpaceId,
        finishedAt: Date.now(),
      });
      navigate('/dashboard/upload-result');
    } catch (error: unknown) {
      console.error('Start HITL upload failed', error);
      const message =
        error instanceof Error && error.message ? error.message : '启动上传流程失败';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingAvailable =
    pendingStatus === 'pending' &&
    !!pendingThreadId &&
    getRemainingSeconds(pendingExpiresAt) > 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6">
      <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(11,15,25,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-white/10 dark:shadow-[0_24px_60px_rgba(11,15,25,0.24)] sm:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-white/40">
              HITL Upload
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
              上传图片并等待人工确认
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-white/70">
              先上传图片给 AI 生成名称、简介、分类和标签，再由你确认或修改后完成最终上传。
            </p>
          </div>
          {pendingAvailable ? (
            <button
              type="button"
              onClick={() => navigate('/dashboard/upload-confirm')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-black/5 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              <Clock3 size={16} />
              继续上次确认（剩余 {remainingSeconds}s）
            </button>
          ) : pendingStatus === 'pending' ? (
            <button
              type="button"
              onClick={clearSession}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
            >
              <RefreshCw size={16} />
              清除已过期草稿
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-5 backdrop-blur-xl dark:border-white/15 dark:bg-white/10 sm:p-6">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="group flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-black/20 bg-slate-900/5 px-6 py-10 text-center transition hover:border-primary hover:bg-primary/10 dark:border-white/20 dark:bg-black/10"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="待分析图片预览"
                className="max-h-[360px] w-full rounded-2xl object-contain"
              />
            ) : (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(98,23,215,0.92),rgba(124,58,237,0.72))] text-white shadow-[0_18px_40px_rgba(98,23,215,0.32)]">
                  <ImagePlus size={34} />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-slate-900 dark:text-white">
                  选择待上传图片
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-white/65">
                  支持 JPG、PNG、WEBP，单张图片大小不超过 15MB。点击此区域后会先上传图片并触发 AI 分析。
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {selectedFile ? (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/10 bg-slate-900/5 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-black/10 dark:text-white/75">
              <span className="truncate">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-4 whitespace-nowrap text-primary transition hover:text-slate-900 dark:hover:text-white"
              >
                重新选择
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 backdrop-blur-xl dark:border-white/15 dark:bg-white/10 sm:p-7">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-white/75">
                上传说明
              </label>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={4}
                maxLength={200}
                placeholder={DEFAULT_QUERY}
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-white/10 dark:bg-black/10 dark:text-white dark:placeholder:text-white/30"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-white/45">
                这段文字会作为第一轮 `/api/chat/stream` 的 `query` 发送给后端。
              </p>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-white/75">
                上传位置
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setSpaceMode('public');
                    setSelectedSpaceId('');
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    spaceMode === 'public'
                      ? 'border-primary bg-primary/15 text-slate-900 dark:bg-primary/20 dark:text-white'
                      : 'border-black/10 bg-white/70 text-slate-700 hover:bg-black/5 dark:border-white/10 dark:bg-black/10 dark:text-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">公共图库</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                    `space_id` 发送为 `null`
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSpaceMode('private')}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    spaceMode === 'private'
                      ? 'border-primary bg-primary/15 text-slate-900 dark:bg-primary/20 dark:text-white'
                      : 'border-black/10 bg-white/70 text-slate-700 hover:bg-black/5 dark:border-white/10 dark:bg-black/10 dark:text-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">个人相册</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                    选择已有相册并把 `space_id` 一并发送
                  </div>
                </button>
              </div>
            </div>

            {spaceMode === 'private' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-white/75">
                  选择相册
                </label>
                <select
                  value={selectedSpaceId}
                  onChange={(event) => setSelectedSpaceId(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-white/10 dark:bg-black/10 dark:text-white"
                >
                  <option value="" className="bg-white text-slate-900 dark:bg-[#1b1332] dark:text-white">
                    {isLoadingSpaces ? '相册加载中...' : '请选择个人相册'}
                  </option>
                  {spaceOptions.map((space) => (
                    <option
                      key={space.id}
                      value={space.id}
                      className="bg-white text-slate-900 dark:bg-[#1b1332] dark:text-white"
                    >
                      {space.spaceName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="rounded-2xl border border-black/10 bg-slate-900/5 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-black/10 dark:text-white/65">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Clock3 size={16} />
                确认时限 60 秒
              </div>
              <p className="mt-2 leading-6">
                AI 返回 `upload_confirmation` 后会进入确认页，并开始 60 秒倒计时。表单草稿会自动保存在本地。
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6217d7,#7c3aed)] px-5 py-4 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(98,23,215,0.34)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  正在上传并触发 AI 分析...
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  开始 AI 分析
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HitlUploadPage;
