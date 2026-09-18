import React, { useMemo } from 'react';
import { Search, RefreshCw, Filter } from 'lucide-react';
import { PictureReviewStatus } from '../../types/picture';
import PortalSelect, { SelectOption } from '../PortalSelect';

interface FilterHeaderProps {
  status: PictureReviewStatus | null;
  onStatusChange: (status: PictureReviewStatus | null) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  onRefresh: () => void;
  loading: boolean;
  total: number;
}

const FilterHeader: React.FC<FilterHeaderProps> = ({
  status,
  onStatusChange,
  searchText,
  onSearchChange,
  onRefresh,
  loading,
  total,
}) => {
  const options: SelectOption<PictureReviewStatus | null>[] = useMemo(
    () => [
      { value: null, label: '全部' },
      { value: PictureReviewStatus.REVIEWING, label: '待审核' },
      { value: PictureReviewStatus.PASS, label: '已通过' },
      { value: PictureReviewStatus.REJECT, label: '已拒绝' },
    ],
    []
  );

  return (
    <div className="sticky top-0 z-30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4 px-1 bg-[var(--bg-header)]/90 backdrop-blur-md border-b border-[var(--border-color)] transition-all duration-300">

      {/* Left: Title & Stats */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">图片审核</h2>
        <span className="px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] font-mono border border-[var(--border-color)]">
          {total} 张
        </span>
      </div>

      {/* Right: Tools */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

        {/* Status Filter */}
        <div className="w-40">
            <PortalSelect
                value={status}
                onChange={onStatusChange}
                options={options}
                icon={<Filter size={16} />}
                placeholder="筛选状态"
                triggerClassName="min-h-12"
            />
        </div>

        {/* Search */}
        <div className="relative flex-1 md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索图片名称/简介"
            className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-sm pl-9 pr-4 py-3 min-h-12 rounded-lg border border-[var(--border-color)] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all placeholder-gray-500"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-color)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="刷新列表"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
};

export default FilterHeader;
