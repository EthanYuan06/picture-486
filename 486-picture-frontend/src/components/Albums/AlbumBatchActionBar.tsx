import React from 'react';
import { Pencil, Trash2, X } from 'lucide-react';

interface AlbumBatchActionBarProps {
  open: boolean;
  selectedCount: number;
  loading?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

const AlbumBatchActionBar: React.FC<AlbumBatchActionBarProps> = ({
  open,
  selectedCount,
  loading,
  onDelete,
  onEdit,
  onCancel,
}) => {
  if (!open) return null;

  const disabled = loading || selectedCount === 0;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="flex items-center gap-4 px-6 py-3 bg-[var(--bg-header)] border border-[var(--border-color)] rounded-full shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 pr-4 border-r border-[var(--border-color)]">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            已选 {selectedCount} 项
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Trash2 size={16} />
            <span>删除</span>
          </button>

          <button
            onClick={onEdit}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-purple-500/20 text-primary hover:text-primaryHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Pencil size={16} />
            <span>编辑</span>
          </button>

          <button
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-gray-500/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <X size={16} />
            <span>取消</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumBatchActionBar;
