import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface MemberDeleteConfirmModalProps {
  open: boolean;
  userName: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

const MemberDeleteConfirmModal: React.FC<MemberDeleteConfirmModalProps> = ({ 
  open, 
  userName, 
  loading, 
  onClose, 
  onConfirm 
}) => {
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

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      {/* Modal Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200">
          <div className="p-6">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="p-2 bg-red-500/10 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold">移除成员</h3>
            </div>

            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
              确定要移除成员 <span className="text-[var(--text-primary)] font-bold">{userName}</span> 吗？
              <br />
              <span className="text-xs text-red-400 mt-1 block">移除后该成员将无法访问此团队相册。</span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>移除中...</span>
                  </>
                ) : (
                  <span>确认移除</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MemberDeleteConfirmModal;
