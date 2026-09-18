import React from 'react';
import { Picture, PictureReviewStatus } from '../../types/picture';
import { Check, Edit, Clock, X } from 'lucide-react';
import { toWebpUrl } from '../../utils/image';

interface MyImageCardProps {
  picture: Picture;
  selected: boolean;
  deleting?: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onClick: (picture: Picture) => void;
}

const MyImageCard: React.FC<MyImageCardProps> = ({ picture, selected, deleting, onSelect, onClick }) => {
  const getStatusBadge = (status: any) => {
    const s = Number(status);
    switch (s) {
      case PictureReviewStatus.PASS:
        return (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 backdrop-blur-md text-green-400 text-xs font-medium">
            <Check size={12} />
            <span>已通过</span>
          </div>
        );
      case PictureReviewStatus.REJECT:
        return (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-md text-red-400 text-xs font-medium">
            <X size={12} />
            <span>已拒绝</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 backdrop-blur-md text-yellow-400 text-xs font-medium">
            <Clock size={12} />
            <span>待审核</span>
          </div>
        );
    }
  };

  const formatSize = (size?: number) => {
    if (!size) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const originalSrc = picture.url;
  const webpSrc = toWebpUrl(originalSrc);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (originalSrc && e.currentTarget.src !== originalSrc) {
      e.currentTarget.src = originalSrc;
    }
  };

  return (
    <div
      className={`
        group relative w-full aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all duration-300
        ${selected ? 'ring-2 ring-primary shadow-lg shadow-primary/20' : 'hover:shadow-xl hover:shadow-black/50 border border-white/5'}
        ${deleting ? 'opacity-0 scale-[0.98] blur-[1px] duration-200 pointer-events-none' : ''}
      `}
    >
      <img
        src={webpSrc || originalSrc}
        alt={picture.name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
        onError={handleImageError}
      />

      {/* Checkbox (Top Left) */}
      <div
        className="absolute top-3 left-3 z-20"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(picture.id, !selected);
        }}
      >
        <div className={`
          w-5 h-5 rounded-md border transition-all duration-200 flex items-center justify-center
          ${selected
            ? 'bg-primary border-primary text-white'
            : 'bg-black/40 border-white/30 text-transparent hover:border-white/60'}
        `}>
          <Check size={14} strokeWidth={3} />
        </div>
      </div>

      {/* Status Badge (Top Right) */}
      <div className="absolute top-3 right-3 z-10">
        {getStatusBadge(picture.reviewStatus ?? (picture as any).status)}
      </div>

      {/* Hover Overlay with Action Button */}
      <div
        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px] z-10"
        onClick={() => onClick(picture)}
      >
        <button className="px-4 py-2 bg-primary/90 hover:bg-primary text-white rounded-full font-medium shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2">
          <Edit size={16} />
          编辑/详情
        </button>
      </div>

      {/* Bottom Info Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-0" />

      {/* Info Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10 pointer-events-none">
        <h3 className="text-white font-medium truncate mb-1 text-sm">{picture.name}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span className="uppercase bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{picture.picFormat || 'JPG'}</span>
          <span>{formatSize(picture.picSize)}</span>
        </div>
      </div>
    </div>
  );
};

export default MyImageCard;
