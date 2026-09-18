import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  UploadCloud,
  X,
  FileImage,
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useNavigate } from 'react-router-dom';
import { Picture } from '../../types/picture';
import { Space, SpaceType } from '../../types/space';
import { SpaceRole } from '../../types/spaceUser';
import { ensureSpaceNames, getSpaceNameMapSnapshot, getSpaceByIdAdmin, getSpaceById } from '../../services/space';
import { getSpaceUser } from '../../services/spaceUser';
import { listPictureVoByPage, deletePicture, deletePictureBatch, editPicture, editPictureBatch, uploadPicture, getPictureTagCategory, uploadPictureBatch, listPictureByPage, getPictureById, getPictureVoById } from '../../services/picture';
import { formatDate } from '../../utils/date';
import { toWebpUrl } from '../../utils/image';
import DeleteConfirmModal from '../PictureManage/DeleteConfirmModal';
import AlbumBatchActionBar from './AlbumBatchActionBar';
import AlbumBatchEditModal from './AlbumBatchEditModal';
import AlbumImageDetailModal from './AlbumImageDetailModal';

import { useUserMapStore } from '../../stores/userMap';
import { useToastStore } from '../../stores/toastStore';
interface AlbumDetailPageProps {
  id: string;
  onBack: () => void;
  adminView?: boolean;
}

const AlbumDetailPage: React.FC<AlbumDetailPageProps> = ({ id, onBack, adminView = false }) => {
  const navigate = useNavigate();
  const userInfo = useAuthStore((s) => s.userInfo);
  const isAdmin = !!userInfo?.roles?.includes('admin');
  const actualAdminView = adminView || isAdmin;

  const pageSize = 10;

  // Data
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [spaceNameMap, setSpaceNameMap] = useState<Record<string, string>>(() => getSpaceNameMapSnapshot());
  const [adminSpaceInfo, setAdminSpaceInfo] = useState<Space | null>(null);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const userMap = useUserMapStore((state) => state.userMap);

  // Permissions
  const isSystemAdmin = !!userInfo?.roles?.includes('admin');
  const isOwner = !!(userInfo && currentSpace && String(currentSpace.userId) === String(userInfo.id));
  const isSpaceAdmin = myRole === SpaceRole.ADMIN;
  const isSpaceEditor = myRole === SpaceRole.EDITOR;

  const canManage = isSystemAdmin || isOwner || isSpaceAdmin || isSpaceEditor; // Edit/Delete/Upload
  const canManageMembers = isSystemAdmin || isOwner || isSpaceAdmin; // Only Admins can manage members
  // Note: Viewers cannot see edit/delete buttons.
  // Note: Collaborators (Editors) can see edit/delete buttons.
  
  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  // Detail Modal
  const [detailPicture, setDetailPicture] = useState<Picture | null>(null);

  const detailIndex = useMemo(() => {
    if (!detailPicture) return -1;
    return pictures.findIndex(p => p.id === detailPicture.id);
  }, [detailPicture, pictures]);

  const handleDetailPrev = () => {
    if (detailIndex > 0) {
      setDetailPicture(pictures[detailIndex - 1]);
    }
  };

  const handleDetailNext = () => {
    if (detailIndex !== -1 && detailIndex < pictures.length - 1) {
      setDetailPicture(pictures[detailIndex + 1]);
    }
  };

  // Upload
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [contentWidth, setContentWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerWidth;
  });

  // --- Data Fetching ---

  const fetchPictures = useCallback(async (currentPage: number, isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetching(true);
    try {
      setErrorMessage(null);
      const queryParams = {
        current: currentPage,
        pageSize,
        spaceId: id,
        sortField: 'createTime',
        sortOrder: 'descend',
      };

      const res = actualAdminView
        ? await listPictureByPage(queryParams)
        : await listPictureVoByPage(queryParams);

      if (res) {
        if (isRefresh) {
          setPictures(res.records);
          setTotal(res.total);
        } else {
          setPictures(prev => [...prev, ...res.records]);
        }
        setHasMore(res.records.length === pageSize);
        const spaceIds = res.records.map((p) => p.spaceId).filter(Boolean);
        const map = await ensureSpaceNames([id, ...spaceIds]);
        const keys = Object.keys(map);
        if (keys.length > 0) {
          setSpaceNameMap((prev) => ({ ...prev, ...map }));
        }
      } else {
        if (isRefresh) setPictures([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to fetch pictures:", error);
      const msg = error instanceof Error && error.message ? error.message : '加载相册失败';
      setErrorMessage(msg);
      setPictures([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    setPictures([]);
    setTotal(0);
    setPage(1);
    setHasMore(true);
    setIsSelectionMode(false);
    setSelectedIds([]);
    fetchPictures(1, true);

    if (actualAdminView) {
      getSpaceByIdAdmin(id).then(space => {
        setAdminSpaceInfo(space);
        setCurrentSpace(space);
        // Fetch creator name if needed
        if (space.userId) {
          useUserMapStore.getState().fetchUser(space.userId);
        }
      }).catch(err => {
        console.error("Failed to fetch space info (admin):", err);
      });
    } else {
      // Fetch space details for permission check
      getSpaceById(id).then(space => {
        setCurrentSpace(space);
        if (Number(space.spaceType) === SpaceType.TEAM && userInfo) {
             getSpaceUser({ spaceId: id, userId: String(userInfo.id) })
                .then(res => setMyRole(res.spaceRole))
                .catch(() => {});
        }
      }).catch(err => {
         console.error("Failed to fetch space info:", err);
      });

      ensureSpaceNames([id]).then((map) => {
        const keys = Object.keys(map);
        if (keys.length > 0) setSpaceNameMap((prev) => ({ ...prev, ...map }));
      });
    }
  }, [fetchPictures, id, actualAdminView, userInfo]);

  useEffect(() => {
    const ids: Array<string | undefined> = [];
    for (const p of pictures) {
      if (!p.user?.userName) ids.push(p.userId);
      if (p.reviewerId && !p.reviewerName) ids.push(p.reviewerId);
    }
    if (ids.length === 0) return;
    useUserMapStore.getState().fetchUsers(ids.filter((v): v is string => !!v));
  }, [pictures]);

  // --- Infinite Scroll ---

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          setPage(prev => {
            const nextPage = prev + 1;
            fetchPictures(nextPage);
            return nextPage;
          });
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetching, fetchPictures]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const compute = () => {
      const w = el.clientWidth;
      if (w > 0) setContentWidth(w);
    };

    compute();
    const onResize = () => compute();
    window.addEventListener('resize', onResize);

    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => compute());
      ro.observe(el);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, []);

  // --- Grouping ---

  const groupedPictures = useMemo(() => {
    const groups: Record<string, Picture[]> = {};
    pictures.forEach(pic => {
      // Use formatDate to get YYYY-MM-DD
      const dateStr = formatDate(pic.createTime);
      const dateKey = dateStr || '未知日期';

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(pic);
    });
    return groups;
  }, [pictures]);

  // --- Handlers ---

  const handleDateSelect = (dateKey: string) => {
    const groupPics = groupedPictures[dateKey] || [];
    const ids = groupPics.map(p => p.id);
    const allSelected = ids.every(id => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...ids])]);
    }

    // Automatically enter selection mode if selecting
    if (!allSelected && !isSelectionMode) {
      setIsSelectionMode(true);
    }
  };

  const handleImageClick = async (pic: Picture) => {
    if (isSelectionMode) {
      setSelectedIds(prev => {
        if (prev.includes(pic.id)) return prev.filter(id => id !== pic.id);
        return [...prev, pic.id];
      });
    } else {
      try {
        // Fetch full details
        const detail = actualAdminView
          ? await getPictureById(pic.id)
          : await getPictureVoById(pic.id);
        setDetailPicture(detail);
      } catch (error) {
        console.error("Failed to fetch picture details:", error);
        // Fallback to existing data
        setDetailPicture(pic);
      }
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleteLoading(true);
    try {
      if (selectedIds.length === 1) {
        await deletePicture({ id: selectedIds[0] });
      } else {
        await deletePictureBatch({ ids: selectedIds });
      }
      // Refresh
      setPictures(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      setDeleteModalOpen(false);
    } catch (error) {
      addToast('删除失败', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDetailDelete = async (pic: Picture) => {
    setDeleteLoading(true);
    try {
      await deletePicture({ id: pic.id });
      setPictures(prev => prev.filter(p => p.id !== pic.id));
      setDetailPicture(null);
      setTotal(prev => Math.max(0, prev - 1));
    } catch (error) {
      addToast('删除失败', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditSubmit = async (payload: { name?: string; category?: string; tags?: string[]; nameRule?: string }) => {
    if (selectedIds.length === 0) return;
    setEditLoading(true);
    try {
      if (selectedIds.length === 1) {
        const base = { id: selectedIds[0] } as { id: string; name?: string; category?: string; tags?: string[] };
        if (payload.category) base.category = payload.category;
        if (payload.tags) base.tags = payload.tags;
        if (payload.name) base.name = payload.name;
        await editPicture(base);
      } else {
        await editPictureBatch({
          pictureIdList: selectedIds,
          category: payload.category,
          tags: payload.tags,
          nameRule: payload.nameRule
        });
      }

      setEditModalOpen(false);
      setIsSelectionMode(false);
      setSelectedIds([]);
      setLoading(true);
      setPictures([]);
      setPage(1);
      await fetchPictures(1, true);
    } catch (error) {
      addToast('编辑失败', 'error');
      console.error(error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFiles(Array.from(e.target.files));
      setUploadModalOpen(true);
      // Reset input value to allow selecting same files again
      e.target.value = '';
    }
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    setUploadFiles([]);
    window.location.reload();
  };

  const topButtonClass =
    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0";

  return (
    <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Header - Fixed */}
      <div className="flex-none z-30 bg-[var(--bg-main)] px-6 py-4 flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors">
            <ChevronLeft size={24} className="text-[var(--text-secondary)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">
              {actualAdminView && adminSpaceInfo ? adminSpaceInfo.spaceName : (spaceNameMap[id] ?? '相册')}
            </h1>
            {!errorMessage && (
              <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                <span>{total}张照片</span>
                <span>·</span>
                <span>最近编辑 {pictures[0]?.editTime ? formatDate(pictures[0].editTime) : '刚刚'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManageMembers && Number(currentSpace?.spaceType) === SpaceType.TEAM && (
            <button
              onClick={() => navigate(`/album-members/${id}`)}
              className={`hidden md:flex flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]`}
            >
              <Users size={16} />
              <span>成员信息</span>
            </button>
          )}

          <button
            onClick={() => navigate(`/album-profile/${id}`)}
            className={`hidden md:flex ${topButtonClass} bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]`}
          >
            <span>相册信息</span>
          </button>

          {canManage && (
            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`${topButtonClass} border
                ${isSelectionMode
                  ? 'bg-[#6217d7] hover:bg-[#4e12ac] text-white border-transparent'
                  : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                }`}
            >
              <MoreHorizontal size={16} />
              <span>批量操作</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#6217d7] hover:bg-[#4e12ac] text-white text-sm font-medium shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              <UploadCloud size={18} />
              <span>上传图片</span>
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Content - Scrollable */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-8 relative">
        {loading && pictures.length === 0 && !errorMessage ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : errorMessage ? (
          <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="text-red-500" size={48} />
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">无法访问该相册</h2>
            <p className="text-[var(--text-secondary)] max-w-md text-center">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-full text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
            >
              <ChevronLeft size={18} />
              返回我的相册
            </button>
          </div>
        ) : pictures.length === 0 ? (
          <div className="h-[70vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-8 group">
              <div className="absolute inset-0 bg-[#6217d7]/30 rounded-3xl blur-2xl group-hover:bg-[#6217d7]/40 transition-all duration-500"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-[#6217d7] to-[#8b5cf6] rounded-3xl shadow-[0_18px_55px_rgba(98,23,215,0.35)] flex items-center justify-center transform group-hover:scale-105 transition-all duration-500">
                <UploadCloud size={40} className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">该相册还没有图片</h2>
            <p className="text-[var(--text-secondary)] mb-8 text-center max-w-md">
              上传你的第一张图片到相册中，开始整理你的美图收藏吧。
            </p>

            <button
              type="button"
              onClick={handleUploadClick}
              className="px-8 py-3 bg-gradient-to-r from-[#6217d7] to-[#8b5cf6] text-[var(--on-primary)] rounded-full font-medium shadow-[0_10px_30px_rgba(98,23,215,0.30)] hover:shadow-[0_14px_40px_rgba(98,23,215,0.40)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
            >
              <UploadCloud size={18} />
              上传图片
            </button>
          </div>
        ) : (
          (Object.entries(groupedPictures) as Array<[string, Picture[]]>).map(([date, groupPics]) => {
            const allSelected = groupPics.every(p => selectedIds.includes(p.id));

            return (
              <div key={date}>
                {/* Date Header */}
                <div
                  className="flex items-center gap-3 mb-4 cursor-pointer group w-fit"
                  onClick={() => handleDateSelect(date)}
                >
                  <div className={`p-2 rounded-lg transition-colors ${allSelected ? 'bg-primary text-white' : 'bg-[var(--bg-card)] text-primary group-hover:bg-primary/10'}`}>
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-xl font-bold">{date}</h3>
                  {isSelectionMode && (
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all
                      ${allSelected ? 'bg-primary border-primary' : 'border-gray-500'}
                    `}>
                      {allSelected && <Check size={14} className="text-white" />}
                    </div>
                  )}
                </div>

                <JustifiedPictureGrid
                  pictures={groupPics}
                  containerWidth={contentWidth}
                  targetRowHeight={240}
                  gap={16}
                  selectionMode={isSelectionMode}
                  selectedIds={selectedIds}
                  onImageClick={handleImageClick}
                />
              </div>
            );
          })
        )}

        {/* Loading Sentinel */}
        {pictures.length > 0 && (
          <div ref={observerTarget} className="h-20 flex items-center justify-center">
            {isFetching && hasMore && <Loader2 className="animate-spin text-primary" />}
            {!hasMore && <span className="text-xs text-[var(--text-secondary)]">已经到底啦 ~</span>}
          </div>
        )}
      </div>

      {/* Batch Action Bar */}
      <AlbumBatchActionBar
        open={isSelectionMode}
        selectedCount={selectedIds.length}
        loading={deleteLoading || editLoading}
        onDelete={() => setDeleteModalOpen(true)}
        onEdit={() => setEditModalOpen(true)}
        onCancel={() => {
          setSelectedIds([]);
          setIsSelectionMode(false);
        }}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        count={selectedIds.length}
        loading={deleteLoading}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />

      <AlbumBatchEditModal
        open={editModalOpen}
        loading={editLoading}
        selectedCount={selectedIds.length}
        canEditName={selectedIds.length === 1}
        onClose={() => {
          if (!editLoading) setEditModalOpen(false);
        }}
        onSubmit={handleEditSubmit}
      />

      {/* Detail Modal */}
      <AlbumImageDetailModal
        picture={detailPicture}
        userNameMap={userMap}
        onClose={() => setDetailPicture(null)}
        onPrev={detailIndex > 0 ? handleDetailPrev : undefined}
        onNext={detailIndex < pictures.length - 1 ? handleDetailNext : undefined}
        onUpdate={canManage ? (updatedPicture) => {
          setDetailPicture(updatedPicture);
          setPictures(prev => prev.map(p => p.id === updatedPicture.id ? updatedPicture : p));
        } : undefined}
        onDelete={canManage ? handleDetailDelete : undefined}
      />

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-main)] w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)] relative flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">批量上传图片</h3>
              <button onClick={() => setUploadModalOpen(false)} className="p-2 hover:bg-[var(--bg-hover)] rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <BatchUploadViewer files={uploadFiles} spaceId={id} onSuccess={handleUploadSuccess} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type PictureDimensions = { width: number; height: number } | null;

function getPictureDimensions(p: Picture): PictureDimensions {
  const w = typeof p.picWidth === 'number' ? p.picWidth : Number(p.picWidth);
  const h = typeof p.picHeight === 'number' ? p.picHeight : Number(p.picHeight);
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null;
  return { width: w, height: h };
}

function getPictureAspectRatio(p: Picture): number {
  const dim = getPictureDimensions(p);
  if (!dim) return 1;
  return dim.width / dim.height;
}

function isSmallPicture(p: Picture): boolean {
  const dim = getPictureDimensions(p);
  if (!dim) return false;
  return dim.width <= 800 && dim.height <= 800;
}

type JustifiedLayoutItem = {
  width: number;
  height: number;
};

function buildJustifiedLayout(
  pictures: Picture[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number
): Record<string, JustifiedLayoutItem> {
  const layout: Record<string, JustifiedLayoutItem> = {};
  const usableWidth = Math.max(1, containerWidth);

  let currentRow: Picture[] = [];
  let currentRowWidth = 0;

  const flushRow = (isLastRow: boolean) => {
    if (currentRow.length === 0) return;

    const gapWidth = gap * (currentRow.length - 1);

    // For last row, if it's not full enough, we don't expand it
    // If last row width (at target height) is less than say 75% of container, don't expand
    if (isLastRow && currentRowWidth + gapWidth < usableWidth * 0.75) {
      // Just lay them out at target height
      let x = 0;
      currentRow.forEach(pic => {
        const ratio = getPictureAspectRatio(pic);
        const w = targetRowHeight * ratio;
        layout[pic.id] = { width: w, height: targetRowHeight };
        x += w + gap;
      });
    } else {
      // Scale to fit width
      // availableWidth = sum(width) + gaps
      // We want newTotalWidth + gaps = usableWidth
      // scale = (usableWidth - gaps) / sum(originalWidths at targetHeight)

      const contentWidthTarget = usableWidth - gapWidth;
      const scale = contentWidthTarget / Math.max(1, currentRowWidth);
      const finalHeight = targetRowHeight * scale;

      currentRow.forEach(pic => {
        const ratio = getPictureAspectRatio(pic);
        const w = finalHeight * ratio;
        layout[pic.id] = { width: w, height: finalHeight };
      });
    }

    currentRow = [];
    currentRowWidth = 0;
  };

  for (const pic of pictures) {
    const ratio = getPictureAspectRatio(pic);
    const w = targetRowHeight * ratio;

    // Check if adding this picture would make the row too wide (with some tolerance)
    // Actually standard algo is: add until > width, then decide to break before or after
    // Simple greedy: add to row. If row width > container width, we check if it's better to break here.

    // Here we use a simple approach: add, then check.
    currentRow.push(pic);
    currentRowWidth += w;

    const currentTotalWidth = currentRowWidth + gap * (currentRow.length - 1);

    if (currentTotalWidth >= usableWidth) {
      // Row is full.
      // However, maybe previous state was better? 
      // For simplicity, we just flush when we exceed. 
      // Or we can check which is closer to usableWidth. 
      // But 'Justified' usually means we shrink to fit or expand to fit. 
      // If we exceed a lot, we might want to push this image to next row.
      // Let's check: if (currentTotalWidth - usableWidth) > (usableWidth - (previousWidth)) ...
      // For now, simpler: if we exceed, flush.
      // Actually, to avoid super squashed images, we should be careful.

      // Refined Greedy:
      // If adding this image makes the row significantly wider than target, we might move it to next row
      // UNLESS it's the only image.

      // Let's stick to standard "flush immediately" logic for now, but ensure we handle single huge image.
      flushRow(false);
    }
  }

  // Flush remaining
  flushRow(true);

  return layout;
}

const JustifiedPictureGrid: React.FC<{
  pictures: Picture[];
  containerWidth: number;
  targetRowHeight: number;
  gap: number;
  selectionMode: boolean;
  selectedIds: string[];
  onImageClick: (pic: Picture) => void;
}> = ({ pictures, containerWidth, targetRowHeight, gap, selectionMode, selectedIds, onImageClick }) => {
  const layout = useMemo(() =>
    buildJustifiedLayout(pictures, containerWidth, targetRowHeight, gap),
    [pictures, containerWidth, targetRowHeight, gap]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap
      }}
    >
      {pictures.map(pic => {
        const l = layout[pic.id];
        if (!l) return null;
        return (
          <div
            key={pic.id}
            style={{ width: l.width, height: l.height }}
            className="relative group cursor-pointer"
            onClick={() => onImageClick(pic)}
          >
            <AlbumPictureTile
              picture={pic}
              selected={selectedIds.includes(pic.id)}
              selectionMode={selectionMode}
              layout={{ width: l.width, height: l.height }}
              fit="cover" // Justified layout ensures aspect ratio matches container
            />
            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="absolute top-2 left-2 max-w-[80%] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-xs text-white truncate border-l-2 border-white/50">
                {pic.name}
              </div>
            </div>
            {(selectionMode || selectedIds.includes(pic.id)) && (
              <div className="absolute top-2 right-2 z-10">
                <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-sm
                      ${selectedIds.includes(pic.id) ? 'bg-primary border-primary' : 'bg-black/30 border-white/70 hover:bg-black/50'}
                    `}>
                  {selectedIds.includes(pic.id) && <Check size={14} className="text-white" />}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-[10px] text-white/80 font-mono">
                {pic.picWidth}x{pic.picHeight}
              </span>
              <button className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SmallPictureCard: React.FC<{
  picture: Picture;
  selected: boolean;
  selectionMode: boolean;
  onClick: () => void;
}> = ({ picture, selected, selectionMode, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const originalSrc = picture.url;
  const webpSrc = toWebpUrl(originalSrc);
  const dim = getPictureDimensions(picture);

  return (
    <div
      className={`
        relative group cursor-pointer bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden
        ${selected ? 'ring-4 ring-primary border-transparent' : 'hover:border-primary/30'}
      `}
      style={{ aspectRatio: '1 / 1' }}
      onClick={onClick}
    >
      <div className="absolute inset-0 p-4 flex items-center justify-center bg-[var(--bg-image-surface)]">
        {!loaded && <div className="absolute inset-0 bg-[var(--bg-hover)] animate-pulse" />}
        <img
          src={webpSrc || originalSrc}
          alt={picture.name}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            if (originalSrc && e.currentTarget.src !== originalSrc) {
              e.currentTarget.src = originalSrc;
              return;
            }
            setLoaded(true);
          }}
        />
      </div>

      <div className="absolute left-2 right-2 bottom-2 flex items-end justify-between gap-2 pointer-events-none">
        <div className="min-w-0">
          <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white truncate border-l-2 border-white/50">
            {picture.name}
          </div>
          {dim && (
            <div className="mt-1 text-[10px] text-white/80 font-mono bg-black/35 backdrop-blur-md px-2 py-0.5 rounded w-fit">
              {dim.width}x{dim.height}
            </div>
          )}
        </div>
      </div>

      {(selectionMode || selected) && (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-sm
              ${selected ? 'bg-primary border-primary' : 'bg-black/30 border-white/70 hover:bg-black/50'}
            `}
          >
            {selected && <Check size={14} className="text-white" />}
          </div>
        </div>
      )}
    </div>
  );
};

const AlbumPictureTile: React.FC<{
  picture: Picture;
  selected: boolean;
  selectionMode: boolean;
  layout?: { width: number; height: number };
  fit?: 'cover' | 'contain';
  padded?: boolean;
}> = ({ picture, selected, selectionMode, layout, fit = 'cover', padded = false }) => {
  const [loaded, setLoaded] = useState(false);

  const aspectRatio =
    picture.picWidth && picture.picHeight && picture.picWidth > 0 && picture.picHeight > 0
      ? `${picture.picWidth} / ${picture.picHeight}`
      : '1 / 1';

  const originalSrc = picture.url;
  const webpSrc = toWebpUrl(originalSrc);

  return (
    <div
      className={`
        rounded-xl overflow-hidden relative border transition-all duration-200
        ${layout ? 'w-full h-full' : ''}
        ${selected ? 'ring-4 ring-primary border-transparent' : 'border-transparent hover:border-white/20 hover:shadow-xl'}
      `}
      style={layout ? undefined : { aspectRatio }}
    >
      {!loaded && <div className="absolute inset-0 bg-[var(--bg-hover)] animate-pulse" />}

      {padded && <div className="absolute inset-0 bg-[var(--bg-image-surface)]" />}

      <img
        src={webpSrc || originalSrc}
        alt={picture.name}
        className={`absolute inset-0 w-full h-full block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{
          objectFit: fit,
          padding: padded ? 16 : undefined,
          background: padded ? 'var(--bg-image-surface)' : undefined,
        }}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          if (originalSrc && e.currentTarget.src !== originalSrc) {
            e.currentTarget.src = originalSrc;
            return;
          }
          setLoaded(true);
        }}
      />

      {(selectionMode || selected) && !loaded && <div className="absolute inset-0 bg-black/10" />}
    </div>
  );
};

// --- Batch Upload Viewer ---

interface BatchUploadItem {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const BatchUploadViewer: React.FC<{ files: File[], spaceId: string, onSuccess: () => void }> = ({ files, spaceId, onSuccess }) => {
  const [queue, setQueue] = useState<BatchUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [autoRefreshTriggered, setAutoRefreshTriggered] = useState(false);

  useEffect(() => {
    // Initialize queue with passed files
    const newItems: BatchUploadItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'waiting',
      progress: 0
    }));
    setQueue(newItems);
    setAutoRefreshTriggered(false);
  }, [files]);

  useEffect(() => {
    if (autoRefreshTriggered) return;
    if (isUploading) return;
    if (queue.length === 0) return;
    if (!queue.every(q => q.status === 'success')) return;

    setAutoRefreshTriggered(true);
  }, [autoRefreshTriggered, isUploading, queue]);

  useEffect(() => {
    if (autoRefreshTriggered) {
      const t = setTimeout(() => {
        onSuccess();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [autoRefreshTriggered, onSuccess]);

  const handleStartUpload = async () => {
    const waitingItems = queue.filter(q => q.status === 'waiting' || q.status === 'error');
    if (waitingItems.length === 0) return;

    setIsUploading(true);

    if (waitingItems.length === 1) {
      // Single upload
      const item = waitingItems[0];
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 0 } : q));

      try {
        const interval = setInterval(() => {
          setQueue(prev => prev.map(q => q.id === item.id && q.progress < 90 ? { ...q, progress: q.progress + 10 } : q));
        }, 100);

        const res = await uploadPicture(item.file, { spaceId });
        clearInterval(interval);

        if (res && res.id) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', progress: 100 } : q));
        } else {
          throw new Error("Upload failed");
        }
      } catch (e: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message || 'Error', progress: 0 } : q));
      }
    } else {
      // Batch upload
      const ids = waitingItems.map(q => q.id);
      setQueue(prev => prev.map(q => ids.includes(q.id) ? { ...q, status: 'uploading', progress: 0 } : q));

      // Fake progress for all
      const interval = setInterval(() => {
        setQueue(prev => prev.map(q => ids.includes(q.id) && q.progress < 90 ? { ...q, progress: q.progress + 10 } : q));
      }, 100);

      try {
        const files = waitingItems.map(q => q.file);
        const res = await uploadPictureBatch(files, spaceId);
        clearInterval(interval);

        const resAny = res as any;
        const uploadedCount = Array.isArray(resAny?.data) ? resAny.data.length : (Array.isArray(resAny) ? resAny.length : 0);
        if (uploadedCount === files.length) {
          setQueue(prev => prev.map(q => ids.includes(q.id) ? { ...q, status: 'success', progress: 100 } : q));
        } else {
          throw new Error("部分文件上传失败");
        }
      } catch (e: any) {
        clearInterval(interval);
        setQueue(prev => prev.map(q => ids.includes(q.id) ? { ...q, status: 'error', error: e.message || 'Error', progress: 0 } : q));
      }
    }

    setIsUploading(false);
  };

  const handleRemove = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const completedCount = queue.filter(q => q.status === 'success').length;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)]">
        <div>
          <div className="text-lg font-bold">{completedCount} / {queue.length} 完成</div>
          <div className="text-sm text-[var(--text-secondary)]">准备上传到当前相册</div>
        </div>
        <button
          onClick={handleStartUpload}
          disabled={isUploading || queue.length === 0}
          className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primaryHover disabled:opacity-50 flex items-center gap-2"
        >
          {isUploading && <Loader2 className="animate-spin" size={16} />}
          {isUploading ? '上传中...' : '开始上传'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
        {queue.map(item => (
          <div key={item.id} className="flex items-center gap-4 bg-[var(--bg-hover)] p-3 rounded-xl border border-[var(--border-color)]">
            <div className="w-12 h-12 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={URL.createObjectURL(item.file)} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="font-medium truncate">{item.file.name}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {(item.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${item.status === 'success' ? 'bg-green-500' :
                    item.status === 'error' ? 'bg-red-500' :
                      'bg-primary'
                    }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.error && <div className="text-xs text-red-400 mt-1">{item.error}</div>}
            </div>
            <div className="flex-shrink-0">
              {item.status === 'waiting' && <button onClick={() => handleRemove(item.id)} className="p-2 hover:bg-black/10 rounded-full"><X size={16} /></button>}
              {item.status === 'success' && <CheckCircle className="text-green-500" size={20} />}
              {item.status === 'error' && <AlertCircle className="text-red-500" size={20} />}
              {item.status === 'uploading' && <Loader2 className="animate-spin text-primary" size={20} />}
            </div>
          </div>
        ))}
        {queue.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-[var(--text-secondary)]">
            <FileImage size={40} className="mb-2 opacity-50" />
            <p>没有文件</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumDetailPage;
