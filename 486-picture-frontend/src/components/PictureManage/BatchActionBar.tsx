import React from 'react';
import { CheckCircle, XCircle, Trash2, X } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onCancel: () => void;
  loading?: boolean;
  hideReview?: boolean;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onApprove,
  onReject,
  onDelete,
  onCancel,
  loading,
  hideReview = false
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="flex items-center gap-4 px-6 py-3 bg-white dark:bg-black backdrop-blur-xl border border-gray-200 dark:border-white/20 rounded-full shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 pr-4 border-r border-gray-200 dark:border-white/10">
          <span className="text-sm font-medium text-gray-900 dark:text-white">已选 {selectedCount} 项</span>
        </div>

        <div className="flex items-center gap-2">
          {!hideReview && (
            <>
              <button
                onClick={onApprove}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-green-500/10 dark:hover:bg-green-500/20 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <CheckCircle size={16} />
                <span>批量通过</span>
              </button>

              <button
                onClick={onReject}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <XCircle size={16} />
                <span>批量拒绝</span>
              </button>
            </>
          )}

          <button
            onClick={onDelete}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50 text-sm font-medium"
            title="批量删除"
          >
            <Trash2 size={16} />
            <span>删除</span>
          </button>
        </div>

        <div className="pl-2 ml-2 border-l border-gray-200 dark:border-white/10">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <X size={16} />
            <span>取消选择</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchActionBar;
