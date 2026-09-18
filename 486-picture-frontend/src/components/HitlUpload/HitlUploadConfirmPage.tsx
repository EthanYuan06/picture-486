import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  Tag,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { continueHitlUpload } from '../../services/hitlUpload';
import { listSpaceVoByPage } from '../../services/space';
import { useAuthStore } from '../../stores/auth';
import { useHitlUploadStore } from '../../stores/hitlUpload';
import { useToastStore } from '../../stores/toastStore';
import type { HitlUploadForm } from '../../types/hitlUpload';
import type { Space } from '../../types/space';
import {
  areHitlFormsEqual,
  getRemainingSeconds,
  normalizeHitlForm,
  validateHitlForm,
} from '../../utils/hitlUpload';

const HitlUploadConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const userInfo = useAuthStore((state) => state.userInfo);
  const threadId = useHitlUploadStore((state) => state.threadId);
  const storedUserId = useHitlUploadStore((state) => state.userId);
  const requestSpaceId = useHitlUploadStore((state) => state.requestSpaceId);
  const sourceSessionId = useHitlUploadStore((state) => state.sourceSessionId);
  const sourceMessageId = useHitlUploadStore((state) => state.sourceMessageId);
  const imageUrl = useHitlUploadStore((state) => state.imageUrl);
  const originalConfirmation = useHitlUploadStore((state) => state.originalConfirmation);
  const draftForm = useHitlUploadStore((state) => state.draftForm);
  const expiresAt = useHitlUploadStore((state) => state.expiresAt);
  const setDraftForm = useHitlUploadStore((state) => state.setDraftForm);
  const resetDraftForm = useHitlUploadStore((state) => state.resetDraftForm);
  const markCancelled = useHitlUploadStore((state) => state.markCancelled);
  const clearSession = useHitlUploadStore((state) => state.clearSession);

  const [form, setForm] = useState<HitlUploadForm>(
    draftForm ?? normalizeHitlForm(originalConfirmation)
  );
  const [tagInput, setTagInput] = useState('');
  const [spaceOptions, setSpaceOptions] = useState<Space[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    getRemainingSeconds(expiresAt)
  );

  useEffect(() => {
    if (!threadId || !originalConfirmation) {
      navigate('/dashboard/upload', { replace: true });
    }
  }, [navigate, originalConfirmation, threadId]);

  useEffect(() => {
    setForm(draftForm ?? normalizeHitlForm(originalConfirmation));
  }, [draftForm, originalConfirmation]);

  useEffect(() => {
    setDraftForm(form);
  }, [form, setDraftForm]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(expiresAt));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [expiresAt]);

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
          addToast('个人相册加载失败，请稍后重试', 'warning');
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

  const originalForm = useMemo(
    () => normalizeHitlForm(originalConfirmation),
    [originalConfirmation]
  );
  const hasModified = useMemo(
    () => !areHitlFormsEqual(form, originalForm),
    [form, originalForm]
  );
  const progress = useMemo(() => {
    if (!expiresAt) {
      return 0;
    }
    const total = 60;
    return Math.max(0, Math.min(100, Math.round((remainingSeconds / total) * 100)));
  }, [expiresAt, remainingSeconds]);
  const isPrivateSpace = form.space_id !== null;

  const updateForm = (patch: Partial<HitlUploadForm>) => {
    setForm((previous) => ({
      ...previous,
      ...patch,
    }));
  };

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) {
      return;
    }
    if (form.tags.includes(nextTag)) {
      addToast('标签不能重复', 'warning');
      return;
    }
    if (form.tags.length >= 10) {
      addToast('标签最多 10 个', 'warning');
      return;
    }
    updateForm({ tags: [...form.tags, nextTag] });
    setTagInput('');
  };

  const handleRestore = () => {
    resetDraftForm();
    setForm(originalForm);
    setTagInput('');
    addToast('已恢复 AI 原始建议', 'success');
  };

  const handleConfirm = async () => {
    if (!threadId) {
      addToast('当前确认会话不存在，请重新上传', 'error');
      navigate('/dashboard/upload');
      return;
    }

    const resolvedUserId = storedUserId ?? (userInfo?.id ? String(userInfo.id) : null);
    if (!resolvedUserId) {
      addToast('登录状态已失效，请重新登录', 'error');
      return;
    }

    const resolvedRequestSpaceId = requestSpaceId ?? originalForm.space_id ?? null;

    const validationMessage = validateHitlForm(form);
    if (validationMessage) {
      addToast(validationMessage, 'error');
      return;
    }

    navigate('/dashboard/assistant', {
      state: {
        hitlResume: {
          requestId: `${threadId}-${Date.now()}`,
          threadId,
          userId: resolvedUserId,
          requestSpaceId: resolvedRequestSpaceId,
          sourceSessionId,
          sourceMessageId,
          modifiedData: hasModified ? form : null,
        },
      },
    });
  };

  const handleCancel = async () => {
    if (!threadId) {
      clearSession();
      navigate('/dashboard/upload', { replace: true });
      return;
    }

    const resolvedUserId = storedUserId ?? (userInfo?.id ? String(userInfo.id) : null);
    const resolvedRequestSpaceId = requestSpaceId ?? originalForm.space_id ?? null;
    if (!resolvedUserId) {
      addToast('登录状态已失效，已清除本地确认草稿', 'warning');
      markCancelled();
      clearSession();
      navigate('/dashboard/upload', { replace: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const chatData = await continueHitlUpload({
        thread_id: threadId,
        query: '',
        user_id: resolvedUserId,
        space_id: resolvedRequestSpaceId,
        user_confirmed: false,
      });
      const reply =
        typeof chatData.reply === 'string' && chatData.reply.trim()
          ? chatData.reply
          : '❌ 已取消上传';
      addToast(reply, 'info');
    } catch (error: unknown) {
      console.error('Cancel HITL upload failed', error);
      addToast('已取消上传', 'info');
    } finally {
      markCancelled();
      clearSession();
      setIsSubmitting(false);
      navigate('/dashboard/upload', { replace: true });
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6">
      <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(11,15,25,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-white/10 dark:shadow-[0_24px_60px_rgba(11,15,25,0.24)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-white/40">
              Human In The Loop
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
              确认 AI 分析结果
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-white/70">
              审阅 AI 生成的名称、简介、分类和标签。所有修改都会自动保存到本地，确认后才会真正完成上传。
            </p>
          </div>

          <div className="min-w-[260px] rounded-2xl border border-black/10 bg-slate-900/5 p-4 dark:border-white/10 dark:bg-black/10">
            <div className="flex items-center justify-between text-sm text-slate-700 dark:text-white/75">
              <span className="inline-flex items-center gap-2">
                <Clock3 size={16} />
                请在 60 秒内确认
              </span>
              <span
                className={
                  remainingSeconds > 10
                    ? 'text-slate-900 dark:text-white'
                    : 'text-amber-700 dark:text-amber-300'
                }
              >
                {remainingSeconds}s
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className={`h-full transition-all ${
                  remainingSeconds > 10 ? 'bg-primary' : 'bg-amber-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {remainingSeconds === 0 ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/50 bg-amber-100/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <span>
              当前会话可能已超时。你仍可尝试提交，若后端返回超时提示，页面会自动带你回到上传页重新开始。
            </span>
          </div>
        ) : null}
      </section>

      <div className="grid flex-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-5 backdrop-blur-xl dark:border-white/15 dark:bg-white/10 sm:p-6">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                图片预览
              </h3>
              {hasModified ? (
                <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs text-slate-900 dark:bg-primary/20 dark:text-white">
                  已修改
                </span>
              ) : (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-200/60 px-3 py-1 text-xs text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100">
                  保持原建议
                </span>
              )}
            </div>
            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-[28px] border border-black/10 bg-slate-900/5 p-4 dark:border-white/10 dark:bg-black/10">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="上传图片预览"
                  className="max-h-[520px] w-full rounded-2xl object-contain"
                />
              ) : (
                <div className="text-sm text-slate-500 dark:text-white/45">
                  暂无图片可预览
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 backdrop-blur-xl dark:border-white/15 dark:bg-white/10 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                AI 分析结果
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/60">
                支持直接编辑，并可随时恢复到 AI 原始建议。
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestore}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:bg-black/10 dark:text-white/80 dark:hover:bg-white/10"
            >
              <RotateCcw size={16} />
              恢复原建议
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-white/75">
                名称
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                maxLength={50}
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-white/10 dark:bg-black/10 dark:text-white dark:placeholder:text-white/30"
                placeholder="请输入图片名称"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-white/40">
                {form.name.length}/50
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-white/75">
                简介
              </label>
              <textarea
                value={form.introduction}
                onChange={(event) =>
                  updateForm({ introduction: event.target.value })
                }
                rows={6}
                maxLength={500}
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-white/10 dark:bg-black/10 dark:text-white dark:placeholder:text-white/30"
                placeholder="请输入 50-500 字简介"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-white/40">
                {form.introduction.length}/500
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-white/75">
                分类
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(event) => updateForm({ category: event.target.value })}
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary dark:border-white/10 dark:bg-black/10 dark:text-white dark:placeholder:text-white/30"
                placeholder="请输入分类"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-white/75">
                标签
              </label>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-black/10">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm text-slate-900 dark:bg-primary/20 dark:text-white"
                  >
                    <Tag size={12} />
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        updateForm({
                          tags: form.tags.filter((item) => item !== tag),
                        })
                      }
                      className="text-slate-600 transition hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="min-w-[180px] flex-1 bg-transparent px-2 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
                  placeholder="输入标签后回车"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-white/40">
                <span>标签数量需在 3-10 个之间</span>
                <span>{form.tags.length}/10</span>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-white/75">
                上传位置
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateForm({ space_id: null })}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    !isPrivateSpace
                      ? 'border-primary bg-primary/15 text-slate-900 dark:bg-primary/20 dark:text-white'
                      : 'border-black/10 bg-white/70 text-slate-700 hover:bg-black/5 dark:border-white/10 dark:bg-black/10 dark:text-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">公共图库</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                    发送 `space_id: null`
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextSpaceId = spaceOptions[0]
                      ? Number(spaceOptions[0].id)
                      : form.space_id;
                    updateForm({ space_id: nextSpaceId ?? null });
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    isPrivateSpace
                      ? 'border-primary bg-primary/15 text-slate-900 dark:bg-primary/20 dark:text-white'
                      : 'border-black/10 bg-white/70 text-slate-700 hover:bg-black/5 dark:border-white/10 dark:bg-black/10 dark:text-white/70 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">个人相册</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                    选择具体相册后上传
                  </div>
                </button>
              </div>

              {isPrivateSpace ? (
                <select
                  value={form.space_id ?? ''}
                  onChange={(event) =>
                    updateForm({
                      space_id: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  className="mt-3 w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-white/10 dark:bg-black/10 dark:text-white"
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
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-5 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-black/10 dark:text-white/80 dark:hover:bg-white/10"
            >
              取消上传
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6217d7,#7c3aed)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(98,23,215,0.34)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  正在提交确认...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  确认上传
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HitlUploadConfirmPage;
