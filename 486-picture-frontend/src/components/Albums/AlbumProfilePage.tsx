import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronLeft,
  Calendar,
  Award,
  Edit,
  Trash2,
  UploadCloud,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import { Space, SpaceLevel, SpaceType } from '../../types/space';
import { SpaceRole } from '../../types/spaceUser';
import { getSpaceById, updateSpace, deleteSpace, uploadSpaceCover } from '../../services/space';
import { getSpaceUser } from '../../services/spaceUser';
import { formatDate } from '../../utils/date';
import { useToastStore } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/auth';
import { toWebpUrl } from '../../utils/image';
import SpaceMemberManage from './SpaceMemberManage';

interface AlbumProfilePageProps {
  id: string;
  onBack: () => void;
  onDeleteSuccess?: () => void;
}

const AlbumProfilePage: React.FC<AlbumProfilePageProps> = ({ id, onBack, onDeleteSuccess }) => {
  const [album, setAlbum] = useState<Space | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const addToast = useToastStore((state) => state.addToast);
  const userInfo = useAuthStore((s) => s.userInfo);

  const fetchAlbum = async () => {
    try {
      setLoading(true);
      const data = await getSpaceById(id);
      setAlbum(data);

      // If team space and user is logged in, fetch role
      if (data.spaceType === SpaceType.TEAM && userInfo) {
        try {
          const roleData = await getSpaceUser({ spaceId: id, userId: String(userInfo.id) });
          if (roleData) {
            setMyRole(roleData.spaceRole);
          }
        } catch (e) {
          // Ignore error (user might not be a member)
          console.log('User is not a member or error fetching role');
        }
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || '获取相册信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAlbum();
    }
  }, [id]);

  const getLevelName = (level: number) => {
    switch (level) {
      case SpaceLevel.COMMON: return '普通版';
      case SpaceLevel.PROFESSIONAL: return '专业版';
      case SpaceLevel.FLAGSHIP: return '旗舰版';
      default: return '未知等级';
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case SpaceLevel.COMMON: return 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400';
      case SpaceLevel.PROFESSIONAL: return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400';
      case SpaceLevel.FLAGSHIP: return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:text-gray-400';
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="text-red-500" size={48} />
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">无法加载相册信息</h2>
        <p className="text-[var(--text-secondary)]">{error}</p>
        <button onClick={onBack} className="px-6 py-2 bg-[var(--bg-hover)] rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
          返回
        </button>
      </div>
    );
  }

  const originalCoverUrl = album.spaceCover?.trim() || '';
  const webpCoverUrl = toWebpUrl(originalCoverUrl);

  // Permission Logic
  const isSystemAdmin = userInfo?.roles?.includes('admin');
  const isOwner = userInfo && String(album.userId) === String(userInfo.id);
  const isSpaceAdmin = myRole === SpaceRole.ADMIN;
  const isSpaceEditor = myRole === SpaceRole.EDITOR;

  const canManageMembers = isSystemAdmin || isOwner || isSpaceAdmin;
  const canEdit = canManageMembers || isSpaceEditor;
  const canDelete = canManageMembers || isSpaceEditor;

  return (
    <div className="w-full h-full flex flex-col relative overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 p-6 pb-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">相册详情</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 pt-0 max-w-4xl mx-auto w-full space-y-8">

        {/* Profile Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl relative">

          {/* Cover Image Background Blur */}
          <div className="absolute inset-0 z-0">
            {album.spaceCover ? (
              <img
                src={webpCoverUrl || originalCoverUrl}
                alt="Background"
                className="w-full h-full object-cover opacity-10 blur-3xl scale-110"
                onError={(e) => {
                  if (originalCoverUrl && e.currentTarget.src !== originalCoverUrl) {
                    e.currentTarget.src = originalCoverUrl;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-transparent opacity-20" />
            )}
          </div>

          <div className="relative z-10 p-8 md:p-12 flex flex-col gap-8 items-start">

            {/* Top Section: Cover & Basic Info */}
            <div className="w-full flex flex-col md:flex-row gap-8 items-start">
              {/* Cover Image - 4:3 Ratio */}
              <div className="w-full md:w-80 aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-black/20 flex-shrink-0 group relative">
                {album.spaceCover ? (
                  <img
                    src={webpCoverUrl || originalCoverUrl}
                    alt={album.spaceName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      if (originalCoverUrl && e.currentTarget.src !== originalCoverUrl) {
                        e.currentTarget.src = originalCoverUrl;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20 bg-[var(--bg-hover)]">
                    <span className="text-sm">暂无封面</span>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border mb-3 ${getLevelColor(album.spaceLevel)}`}>
                    <Award size={14} />
                    {getLevelName(album.spaceLevel)}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">{album.spaceName}</h2>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-4">
                    <Calendar size={16} />
                    <span>{formatDate(album.createTime)} 创建</span>
                  </div>

                  {/* Stats Cards - Moved here */}
                  <div className="grid grid-cols-2 gap-3 mb-2 max-w-md">
                    <div className="bg-[var(--bg-card)]/50 border border-[var(--border-color)] rounded-xl p-3">
                      <div className="text-xs text-[var(--text-secondary)] mb-1">图片总数</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-[var(--text-primary)]">{album.totalCount}</span>
                        <span className="text-xs text-[var(--text-secondary)]">/ {album.maxCount}</span>
                      </div>
                    </div>
                    <div className="bg-[var(--bg-card)]/50 border border-[var(--border-color)] rounded-xl p-3">
                      <div className="text-xs text-[var(--text-secondary)] mb-1">已使用</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-[var(--text-primary)]">{formatSize(album.totalSize)}</span>
                        <span className="text-xs text-[var(--text-secondary)]">/ {formatSize(album.maxSize)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {(canEdit || canDelete) && (
                    <div className="flex flex-wrap gap-4 pt-2">
                      {canEdit && (
                        <button
                          onClick={() => setIsEditModalOpen(true)}
                          className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-full font-medium transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25"
                        >
                          <Edit size={18} />
                          编辑相册
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setIsDeleteModalOpen(true)}
                          className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-full font-medium transition-all hover:-translate-y-0.5"
                        >
                          <Trash2 size={18} />
                          删除相册
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Intro Section */}
            <div className="w-full bg-[var(--bg-main)]/50 dark:bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-[var(--border-color)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">简介</h3>
              <div className="text-[var(--text-primary)] leading-relaxed prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1">
                {album.spaceDesc ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {album.spaceDesc}
                  </ReactMarkdown>
                ) : (
                  <span className="text-[var(--text-secondary)] italic">暂无简介</span>
                )}
              </div>
            </div>

            {/* Member Management (Team Space Only) - Moved to separate page */}{/* 
            {album.spaceType === SpaceType.TEAM && (
              <div className="w-full">
                <SpaceMemberManage
                  spaceId={album.id}
                  isOwnerOrAdmin={!!canManageMembers}
                />
              </div>
            )} */}
          </div>

        </div>

        {/* Edit Modal */}
        {isEditModalOpen && (
          <AlbumEditModal
            album={album}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              fetchAlbum();
            }}
          />
        )}

        {/* Delete Modal */}
        {isDeleteModalOpen && (
          <AlbumDeleteModal
            album={album}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={() => {
              setIsDeleteModalOpen(false);
              if (onDeleteSuccess) {
                onDeleteSuccess();
              } else {
                onBack();
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

// --- Sub Components ---

interface AlbumEditModalProps {
  album: Space;
  onClose: () => void;
  onSuccess: () => void;
}

const AlbumEditModal: React.FC<AlbumEditModalProps> = ({ album, onClose, onSuccess }) => {
  const [name, setName] = useState(album.spaceName);
  const [intro, setIntro] = useState(album.spaceDesc || '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(() => {
    const original = album.spaceCover || '';
    const webp = toWebpUrl(original);
    return webp || original;
  });
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((s) => s.addToast);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      addToast('文件大小不能超过 15MB', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      addToast('请选择图片文件', 'error');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      addToast('相册名称不能为空', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      if (coverFile) {
        await uploadSpaceCover(coverFile, album.id);
      }

      await updateSpace(
        coverFile
          ? {
            id: album.id,
            spaceName: name,
            spaceDesc: intro,
          }
          : {
            id: album.id,
            spaceName: name,
            spaceDesc: intro,
            spaceCover: album.spaceCover,
          }
      );

      addToast('更新成功', 'success');
      onSuccess();
    } catch (err: any) {
      addToast(err.message || '更新失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">编辑相册信息</h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)]"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Cover Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">相册封面</label>
            <div
              className={`relative w-full aspect-[16/9] rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group
                ${dragActive ? 'border-primary bg-primary/10' : 'border-[var(--border-color)] bg-[var(--bg-hover)]'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {coverPreview ? (
                <>
                  <img
                    src={coverPreview}
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const fallback = album.spaceCover || '';
                      if (fallback && e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                    <UploadCloud className="mr-2" size={20} />
                    点击更换封面
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
                  <UploadCloud size={32} className="mb-2 opacity-50" />
                  <p>点击或拖拽上传封面</p>
                  <p className="text-xs mt-1 opacity-50">支持 JPG, PNG, WebP (Max 15MB)</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">相册名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none text-[var(--text-primary)]"
              placeholder="请输入相册名称"
            />
          </div>

          {/* Intro */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">相册简介</label>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none text-[var(--text-primary)] resize-none"
              placeholder="请输入相册简介..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="animate-spin" size={16} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

interface AlbumDeleteModalProps {
  album: Space;
  onClose: () => void;
  onSuccess: () => void;
}

const AlbumDeleteModal: React.FC<AlbumDeleteModalProps> = ({ album, onClose, onSuccess }) => {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const TARGET_TEXT = "我确定要删除此相册";

  const handleDelete = async () => {
    if (confirmText !== TARGET_TEXT) {
      setError("输入内容不正确");
      return;
    }

    try {
      setSubmitting(true);
      await deleteSpace(album.id);
      addToast('相册已删除', 'success');
      onSuccess();
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <AlertCircle size={28} />
            <h3 className="text-xl font-bold">删除相册</h3>
          </div>

          <p className="text-[var(--text-secondary)] mb-4 leading-relaxed">
            您正在尝试删除相册 <span className="text-[var(--text-primary)] font-bold">{album.spaceName}</span>。
            <br />
            <span className="text-red-400 font-medium">该操作将删除其中所有图片，不可恢复，请谨慎操作。</span>
          </p>

          <div className="space-y-2 mb-6">
            <label className="text-sm text-[var(--text-secondary)]">请输入 <span className="font-mono font-bold select-all text-[var(--text-primary)]">{TARGET_TEXT}</span> 以确认：</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              className={`w-full px-4 py-2 bg-[var(--input-bg)] border rounded-lg focus:outline-none text-[var(--text-primary)]
                ${error ? 'border-red-500 focus:border-red-500' : 'border-[var(--border-color)] focus:border-primary'}
              `}
              placeholder={TARGET_TEXT}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting || confirmText !== TARGET_TEXT}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="animate-spin" size={16} />}
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbumProfilePage;
