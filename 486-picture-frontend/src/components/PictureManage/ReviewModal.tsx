import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Picture, PictureReviewStatus } from '../../types/picture';
import { X, CheckCircle, XCircle, User, UserCheck, Calendar, FileType, HardDrive, Info, Download, Maximize2, Tag, Folder, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { toWebpUrl } from '../../utils/image';
import { formatDate } from '../../utils/date';
import ImageZoomPreview from '../ImageZoomPreview';
import { useToastStore } from '../../stores/toastStore';

interface ReviewModalProps {
    picture: Picture | null;
    userNameMap?: Record<string, string>;
    onClose: () => void;
    onSubmit: (id: string, status: PictureReviewStatus, message: string) => Promise<void>;
    onPrev?: () => void;
    onNext?: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ picture, userNameMap, onClose, onSubmit, onPrev, onNext }) => {
    const [status, setStatus] = useState<PictureReviewStatus>(PictureReviewStatus.PASS);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [zoomOpen, setZoomOpen] = useState(false);
    const addToast = useToastStore((state) => state.addToast);

    // Reset state when picture changes
    useEffect(() => {
        if (picture) {
            // Default to current status if it's already reviewed, otherwise PASS
            setStatus(
                picture.reviewStatus === PictureReviewStatus.REVIEWING
                    ? PictureReviewStatus.PASS
                    : picture.reviewStatus
            );
            setMessage(picture.reviewMessage || '');
            setZoomOpen(false);
        }
    }, [picture]);

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

    const handleSubmit = async () => {
        if (status === PictureReviewStatus.REJECT && !message.trim()) {
            addToast('请填写拒绝原因', 'warning');
            return;
        }
        setSubmitting(true);
        await onSubmit(picture.id, status, message);
        setSubmitting(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute top-16 bottom-0 left-64 right-0 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-6 pointer-events-auto">
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
                            className="w-11 h-11 rounded-full bg-black/60 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
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
                            <div className="px-7 py-6 border-b border-[var(--border-color)]">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 w-fit px-2 py-0.5 rounded border border-green-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        <span>ID: {picture.id}</span>
                                    </div>
                                    <a
                                        href={originalUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        download
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] transition-colors"
                                    >
                                        <Download size={14} />
                                        下载原图
                                    </a>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7 scrollbar-thin scrollbar-thumb-white/10">
                                <div className="bg-[var(--bg-hover)] rounded-xl p-4 border border-[var(--border-color)] space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1 col-span-2">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <FileText size={12} />
                                                图片名称
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] break-words">
                                                {picture.name || '-'}
                                            </div>
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <Folder size={12} />
                                                分类
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] break-words">
                                                {picture.category || '-'}
                                            </div>
                                        </div>
                                        <div className="space-y-1 col-span-2">
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
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <User size={12} />
                                                上传用户
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] truncate">
                                                {uploaderName}
                                            </div>
                                            <div className="text-[11px] text-[var(--text-secondary)]">
                                                ID: {picture.userId}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                <UserCheck size={12} />
                                                审核人
                                            </div>
                                            <div className="text-sm text-[var(--text-primary)] truncate">
                                                {reviewerDisplayName}
                                            </div>
                                            {picture.reviewerId && (
                                                <div className="text-[11px] text-[var(--text-secondary)]">
                                                    ID: {picture.reviewerId}
                                                </div>
                                            )}
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
                                        {picture.picWidth && picture.picHeight && (
                                            <div className="space-y-1">
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

                                <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                                    <div className="flex items-center gap-2 text-sm text-primary font-medium">
                                        <Info size={16} />
                                        审核操作
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setStatus(PictureReviewStatus.PASS)}
                                            className={`
                                relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2
                                ${status === PictureReviewStatus.PASS
                                                    ? 'bg-green-500/10 border-green-500 text-green-400'
                                                    : 'bg-[var(--bg-hover)] border-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
                            `}
                                        >
                                            <CheckCircle size={24} />
                                            <span className="font-medium">通过</span>
                                        </button>

                                        <button
                                            onClick={() => setStatus(PictureReviewStatus.REJECT)}
                                            className={`
                                relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2
                                ${status === PictureReviewStatus.REJECT
                                                    ? 'bg-red-500/10 border-red-500 text-red-400'
                                                    : 'bg-[var(--bg-hover)] border-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
                            `}
                                        >
                                            <XCircle size={24} />
                                            <span className="font-medium">拒绝</span>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-[var(--text-secondary)] flex justify-between">
                                            审核意见
                                            {status === PictureReviewStatus.REJECT && <span className="text-red-400">*</span>}
                                        </label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder={
                                                status === PictureReviewStatus.REJECT ? '请填写拒绝原因...' : '可选填审核备注...'
                                            }
                                            className={`
                                w-full h-24 bg-[var(--input-bg)] rounded-xl border p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 transition-all resize-none placeholder-gray-500
                                ${status === PictureReviewStatus.REJECT && !message.trim()
                                                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                                    : 'border-[var(--border-color)] focus:border-primary/50 focus:ring-primary/50'}
                            `}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="px-7 py-5 border-t border-[var(--border-color)] bg-[var(--bg-card)]">
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className={`
                        w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                        ${status === PictureReviewStatus.PASS
                                            ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20'
                                            : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'}
                    `}
                                >
                                    {submitting ? '提交中...' : '提交审核结果'}
                                </button>
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
        </div>,
        document.body
    );
};

export default ReviewModal;
