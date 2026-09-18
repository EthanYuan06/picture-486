import React from 'react';
import { Picture } from '../../types/picture';
import MyImageCard from './MyImageCard';

interface MyImageGridProps {
  loading: boolean;
  pictures: Picture[];
  selectedIds: string[];
  deletingIds?: string[];
  onSelect: (id: string, selected: boolean) => void;
  onClick: (picture: Picture) => void;
}

const MyImageGrid: React.FC<MyImageGridProps> = ({
  loading,
  pictures,
  selectedIds,
  deletingIds,
  onSelect,
  onClick,
}) => {
  // Skeleton Loader
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="w-full aspect-[4/5] bg-white/5 rounded-xl animate-pulse border border-white/5 relative overflow-hidden">
             <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent"></div>
             <div className="absolute bottom-4 left-4 right-4 h-4 bg-white/10 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (pictures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        </div>
        <p className="text-lg font-medium">暂无图片数据</p>
        <p className="text-sm opacity-60 mt-1">请尝试切换筛选条件或刷新列表</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-24 p-1">
      {pictures.map((pic) => (
        <MyImageCard
          key={pic.id}
          picture={pic}
          selected={selectedIds.includes(pic.id)}
          deleting={deletingIds?.includes(pic.id) ?? false}
          onSelect={onSelect}
          onClick={onClick}
        />
      ))}
    </div>
  );
};

export default MyImageGrid;
