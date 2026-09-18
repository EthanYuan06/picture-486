import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  open: boolean;
  count?: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ open, count, loading, onClose, onConfirm, title, description }) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const displayTitle = title || '确认删除资源';
  const displayDescription = description || `你确定要永久删除选中的 ${count} 项吗？此操作执行后将无法找回。`;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[92vw] max-w-[520px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl shadow-black/20 overflow-hidden">
          <div className="px-8 pt-8 pb-7">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/25">
              <AlertTriangle className="text-red-400" size={22} />
            </div>

            <div className="text-center">
              <div className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">{displayTitle}</div>
              <div className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">{displayDescription}</div>
            </div>
          </div>

          <div className="px-8 pb-8 flex items-center gap-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-xl bg-[var(--bg-hover)] text-[14px] font-semibold text-[var(--text-secondary)] ring-1 ring-[var(--border-color)] transition-all duration-200 hover:bg-[var(--bg-hover)]/80 hover:text-[var(--text-primary)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-11 rounded-xl bg-gradient-to-b from-red-500 to-red-600 text-[14px] font-semibold text-white shadow-lg shadow-red-900/25 transition-all duration-200 hover:from-red-400 hover:to-red-600 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              )}
              <span>{loading ? '删除中...' : '确定删除'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmModal;
