import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Picture } from '../../types/picture';
import { X, Download, User, UserCheck, Calendar, FileType, HardDrive, Maximize2, Tag, Folder, FileText, ChevronLeft, ChevronRight, Pencil, Share2, Trash2, Heart, Star } from 'lucide-react';
import { toWebpUrl } from '../../utils/image';
import { formatDate } from '../../utils/date';
import ImageZoomPreview from '../ImageZoomPreview';
import SinglePictureEditModal from './SinglePictureEditModal';
import { editPicture } from '../../services/picture';
import DeleteConfirmModal from '../PictureManage/DeleteConfirmModal';
import { useToastStore } from '../../stores/toastStore';
import { useLayoutStore } from '../../stores/layoutStore';

interface AlbumImageDetailModalProps {
    picture: Picture | null;
    userNameMap?: Record<string, string>;
    onClose: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onUpdate?: (updatedPicture: Picture) => void;
    onDelete?: (picture: Picture) => void | Promise<void>;
}

const AlbumImageDetailModal: React.FC<AlbumImageDetailModalProps> = ({ picture, userNameMap, onClose, onPrev, onNext, onUpdate, onDelete }) => {
    const [zoomOpen, setZoomOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const addToast = useToastStore((state) => state.addToast);
    const isSidebarCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);

    // Reset local state when picture changes
    useEffect(() => {
        setIsLiked(false);
        setIsFavorited(false);
    }, [picture?.id]);

    if (!picture) return null;

    const originalUrl = picture.url;
    const previewSrc = toWebpUrl(originalUrl);
    const uploaderName = picture.user?.userName || (picture.userId ? userNameMap?.[picture.userId] : undefined) || 'Unknown';
    const reviewerDisplayName = picture.reviewerId
        ? picture.reviewerName || userNameMap?.[picture.reviewerId] || 'Unknown'
        : '未审核';

    const normalizedTags = (() => {
        const raw = (picture as any).tags;
        if (Array.isArray(raw)) {
            return raw.map(String).map((s) => s.trim()).filter(Boolean);
        }
        if (typeof raw === 'string') {
            const s = raw.trim();
            if (!s) return [];
            try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) {
                    return parsed.map(String).map((t) => t.trim()).filter(Boolean);
                }
            } catch {
            }
            return s.split(',').map((t) => t.trim()).filter(Boolean);
        }
        return [];
    })();

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        if (originalUrl && e.currentTarget.src !== originalUrl) {
            e.currentTarget.src = originalUrl;
        }
    };

    const handleEditSubmit = async (payload: { name?: string; introduction?: string; category?: string; tags?: string[] }) => {
        if (!picture) return;
        setEditLoading(true);
        try {
            await editPicture({
                id: picture.id,
                ...payload
            });
            setEditOpen(false);
            if (onUpdate) {
                onUpdate({
                    ...picture,
                    ...payload,
                    // Handle tags specifically if payload has it
                    tags: payload.tags ?? picture.tags
                });
            }
        } catch (error) {
            console.error('Failed to edit picture:', error);
            addToast('编辑失败，请重试', 'error');
        } finally {
            setEditLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(originalUrl);
                addToast('链接已复制', 'success');
                return;
            }
            const textarea = document.createElement('textarea');
            textarea.value = originalUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            addToast('链接已复制', 'success');
        } catch {
            addToast('复制失败', 'error');
        }
    };

    const handleConfirmDelete = async () => {
        if (!picture) return;
        if (!onDelete) {
            setDeleteConfirmOpen(false);
            return;
        }
        setDeleteSubmitting(true);
        try {
            await onDelete(picture);
            setDeleteConfirmOpen(false);
        } finally {
            setDeleteSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
            <div className={`absolute top-16 bottom-0 right-0 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-6 pointer-events-auto transition-all duration-300 ${isSidebarCollapsed ? 'left-20' : 'left-64'}`}>
                <div className="relative w-full max-w-6xl h-full max-h-[calc(100vh-7rem)] bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden">

                    <div className="flex items-center px-8 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] min-h-[80px] max-h-[100px]">
                        <div className="w-11" />
                        <h2
                            className="flex-1 text-lg md:text-xl font-bold text-[var(--text-primary)] text-center leading-snug px-4 break-words"
                            title={picture.name}
                        >
                            {picture.name}
                        </h2>
                        <button
                            onClick={onClose}
                            aria-label="关闭"
                            className="w-11 h-11 rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                        <div className="flex-1 bg-[var(--bg-main)] relative flex items-center justify-center p-6 md:p-10 overflow-hidden group/image">
                            {onPrev && (
                                <button
                                    onClick={onPrev}
                                    className="absolute left-4 z-10 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover/image:opacity-100 hover:bg-black/70 transition-all"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                            )}
                            <img
                                src={previewSrc || originalUrl}
                                alt={picture.name}
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-xl cursor-zoom-in"
                                onError={handleImageError}
                                onClick={() => setZoomOpen(true)}
                            />
                            {onNext && (
                                <button
                                    onClick={onNext}
                                    className="absolute right-4 z-10 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover/image:opacity-100 hover:bg-black/70 transition-all"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            )}
                        </div>

                        <div className="w-full lg:w-[420px] flex flex-col border-t lg:border-t-0 lg:border-l border-[var(--border-color)] bg-[var(--bg-card)]">
                            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7 scrollbar-thin scrollbar-thumb-white/10">
                                <div className="bg-[var(--bg-hover)] rounded-xl p-4 border border-[var(--border-color)] space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Row 1: Category & Tags */}
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <Folder size={12} />
                                                分类
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] break-words">
                                                {picture.category || '-'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <Tag size={12} />
                                                标签
                                            </div>
                                            {normalizedTags.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {normalizedTags.map((t) => (
                                                        <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]">
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-[var(--text-secondary)]">
                                                    -
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 2: Uploader & File Size */}
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <User size={12} />
                                                上传用户
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] truncate">
                                                {uploaderName}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <HardDrive size={12} />
                                                文件大小
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)]">
                                                {picture.picSize ? (picture.picSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                                            </div>
                                        </div>

                                        {/* Row 3: Time & Format */}
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <Calendar size={12} />
                                                上传时间
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] truncate" title={picture.createTime}>
                                                {formatDate(picture.createTime)}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <FileType size={12} />
                                                文件格式
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] uppercase">
                                                {picture.picFormat || 'JPG'}
                                            </div>
                                        </div>

                                        {/* Row 4: Resolution (Full Width if odd, or share row) */}
                                        {picture.picWidth && picture.picHeight && (
                                            <div className="space-y-1 col-span-2">
                                                <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                    <Maximize2 size={12} />
                                                    分辨率
                                                </div>
                                                <div className="text-sm text-[var(--text-primary)] font-mono">
                                                    {picture.picWidth} x {picture.picHeight} px
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-[var(--bg-hover)] rounded-xl p-4 border border-[var(--border-color)]">
                                    <div className="text-xs text-[var(--text-secondary)] mb-2 font-medium uppercase tracking-wider">
                                        简介
                                    </div>
                                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                        {picture.introduction || '暂无简介...'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-card)]">
                                <div className="grid grid-cols-4 gap-3">
                                    {onUpdate ? (
                                        <button
                                            type="button"
                                            onClick={() => setEditOpen(true)}
                                            aria-label="编辑"
                                            title="编辑"
                                            className="h-12 w-full rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-primary hover:text-white transition-all duration-200 flex items-center justify-center"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsLiked(!isLiked)}
                                            aria-label="喜欢"
                                            title="喜欢"
                                            className={`h-12 w-full rounded-xl bg-[var(--bg-hover)] transition-all duration-200 flex items-center justify-center ${
                                                isLiked 
                                                ? 'text-red-500 hover:bg-red-500/10' 
                                                : 'text-[var(--text-primary)] hover:bg-primary hover:text-white'
                                            }`}
                                        >
                                            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                                        </button>
                                    )}

                                    <a
                                        href={originalUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        download
                                        aria-label="下载"
                                        title="下载"
                                        className="h-12 w-full rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-primary hover:text-white transition-all duration-200 flex items-center justify-center"
                                    >
                                        <Download size={18} />
                                    </a>

                                    <button
                                        type="button"
                                        onClick={handleShare}
                                        aria-label="分享"
                                        title="分享"
                                        className="h-12 w-full rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-primary hover:text-white transition-all duration-200 flex items-center justify-center"
                                    >
                                        <Share2 size={18} />
                                    </button>

                                    {onDelete ? (
                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmOpen(true)}
                                            aria-label="删除"
                                            title="删除"
                                            className="h-12 w-full rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-red-500 hover:text-white transition-all duration-200 flex items-center justify-center"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsFavorited(!isFavorited)}
                                            aria-label="收藏"
                                            title="收藏"
                                            className={`h-12 w-full rounded-xl bg-[var(--bg-hover)] transition-all duration-200 flex items-center justify-center ${
                                                isFavorited 
                                                ? 'text-yellow-500 hover:bg-yellow-500/10' 
                                                : 'text-[var(--text-primary)] hover:bg-primary hover:text-white'
                                            }`}
                                        >
                                            <Star size={18} fill={isFavorited ? "currentColor" : "none"} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ImageZoomPreview
                open={zoomOpen}
                src={previewSrc}
                alt={picture.name}
                onClose={() => setZoomOpen(false)}
            />
            <SinglePictureEditModal
                open={editOpen}
                loading={editLoading}
                picture={picture}
                onClose={() => setEditOpen(false)}
                onSubmit={handleEditSubmit}
            />
            <DeleteConfirmModal
                open={deleteConfirmOpen}
                count={1}
                loading={deleteSubmitting}
                onClose={() => {
                    if (!deleteSubmitting) setDeleteConfirmOpen(false);
                }}
                onConfirm={handleConfirmDelete}
            />
        </div>,
        document.body
    );
};

export default AlbumImageDetailModal;
