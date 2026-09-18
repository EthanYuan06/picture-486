import React, { useEffect } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, ImageIcon, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHitlUploadStore } from '../../stores/hitlUpload';

const HitlUploadResultPage: React.FC = () => {
  const navigate = useNavigate();
  const result = useHitlUploadStore((state) => state.result);
  const imageUrl = useHitlUploadStore((state) => state.imageUrl);
  const clearSession = useHitlUploadStore((state) => state.clearSession);

  useEffect(() => {
    if (!result) {
      navigate('/dashboard/upload', { replace: true });
    }
  }, [navigate, result]);

  if (!result) {
    return null;
  }

  const previewUrl = result.imageUrl || imageUrl;
  const isSuccess = result.status === 'success';

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6">
      <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(11,15,25,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-white/10 dark:shadow-[0_24px_60px_rgba(11,15,25,0.24)] sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                isSuccess
                  ? 'bg-emerald-200/60 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
                  : 'bg-rose-200/60 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200'
              }`}
            >
              {isSuccess ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-white/40">
                Upload Result
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {isSuccess ? '上传完成' : '上传流程已结束'}
              </h2>
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-slate-900/5 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-black/10 dark:text-white/55">
            完成时间：{new Date(result.finishedAt).toLocaleString()}
          </div>
        </div>
      </section>

      <div className="grid flex-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-black/10 bg-white/80 p-5 backdrop-blur-xl dark:border-white/15 dark:bg-white/10 sm:p-6">
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-[28px] border border-black/10 bg-slate-900/5 p-4 dark:border-white/10 dark:bg-black/10">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="上传结果图片"
                className="max-h-[520px] w-full rounded-2xl object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-white/45">
                <ImageIcon size={28} />
                <span className="text-sm">当前没有可展示的图片预览</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/80 p-6 backdrop-blur-xl dark:border-white/15 dark:bg-white/10 sm:p-7">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">处理结果</h3>
          <div className="mt-4 rounded-2xl border border-black/10 bg-slate-900/5 p-4 text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-black/10 dark:text-white/75">
            {result.reply}
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-black/10 bg-slate-900/5 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-black/10 dark:text-white/70">
            {result.pictureId ? <div>图片 ID：{result.pictureId}</div> : null}
            {result.spaceId !== undefined ? (
              <div>目标位置：{result.spaceId === null ? '公共图库' : `个人相册 #${result.spaceId}`}</div>
            ) : null}
            {result.pictureUrl ? (
              <a
                href={result.pictureUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary transition hover:text-slate-900 dark:hover:text-white"
              >
                查看图片链接
                <ExternalLink size={16} />
              </a>
            ) : null}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate('/dashboard/upload', { replace: true });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6217d7,#7c3aed)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(98,23,215,0.34)] transition hover:brightness-110"
            >
              <RefreshCw size={18} />
              继续上传
            </button>
            <button
              type="button"
              onClick={() => {
                clearSession();
                navigate('/dashboard/gallery');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-5 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-black/5 dark:border-white/10 dark:bg-black/10 dark:text-white/80 dark:hover:bg-white/10"
            >
              <ArrowLeft size={18} />
              返回首页
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HitlUploadResultPage;
