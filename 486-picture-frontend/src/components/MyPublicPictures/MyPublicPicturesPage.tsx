import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UploadCloud } from 'lucide-react';
import { Picture, PictureQueryRequest } from '../../types/picture';
import { listPictureVoByPage, deletePicture, deletePictureBatch, getPictureVoById } from '../../services/picture';
import { useAuthStore } from '../../stores/auth';
import MyImageGrid from './MyImageGrid';
import BatchActionBar from '../PictureManage/BatchActionBar';
import DeleteConfirmModal from '../PictureManage/DeleteConfirmModal';
import AlbumImageDetailModal from '../Albums/AlbumImageDetailModal';
import { useToastStore } from '../../stores/toastStore';
import { useUserMapStore } from '../../stores/userMap';

const MyPublicPicturesPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const userMap = useUserMapStore((state) => state.userMap);

  // Data State
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Filter State
  const [searchText, setSearchText] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal State
  const [detailPicture, setDetailPicture] = useState<Picture | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  // --- Data Fetching ---
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!auth.userInfo?.id) return;
    setLoading(true);

    const request: PictureQueryRequest = {
      current: isRefresh ? 1 : currentPage,
      pageSize,
      sortField: 'createTime',
      sortOrder: 'descend',
      searchText: searchText || undefined,
      userId: auth.userInfo.id,
      nullSpaceId: true, // Public gallery
    };

    try {
      const res = await listPictureVoByPage(request);
      if (res) {
        setPictures(res.records);
        setTotal(res.total);
        if (isRefresh) setCurrentPage(1);
      }
    } catch (err) {
      console.error(err);
      addToast('获取图片列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchText, auth.userInfo?.id, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---

  const handleSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === pictures.length && pictures.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pictures.map(p => p.id));
    }
  };

  // Detail Modal Logic
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

  const handleImageClick = async (pic: Picture) => {
    try {
      const detail = await getPictureVoById(pic.id);
      setDetailPicture(detail);
    } catch (error) {
      console.error("Failed to fetch picture details:", error);
      setDetailPicture(pic);
    }
  };

  const handleDetailDelete = async (pic: Picture) => {
    try {
      await deletePicture({ id: pic.id });
      setPictures(prev => prev.filter(p => p.id !== pic.id));
      setDetailPicture(null);
      setTotal(prev => Math.max(0, prev - 1));
      addToast('删除成功', 'success');
    } catch (error) {
      addToast('删除失败', 'error');
    }
  };

  // Batch Delete
  const handleBatchDeleteClick = () => {
    if (selectedIds.length === 0) return;
    if (loading || deleteLoading) return;
    setDeleteModalOpen(true);
  };

  const handleBatchDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];
    setDeleteModalOpen(false);
    setDeleteLoading(true);
    setDeletingIds(idsToDelete);

    try {
      let success = false;
      if (idsToDelete.length === 1) {
        success = await deletePicture({ id: idsToDelete[0] });
      } else {
        success = await deletePictureBatch({ ids: idsToDelete });
      }

      if (success) {
        addToast('删除成功', 'success');
        setPictures((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
        setTotal((prev) => Math.max(0, prev - idsToDelete.length));
        setSelectedIds([]);
      } else {
        addToast('删除失败', 'error');
        fetchData();
      }
    } catch (error) {
      console.error(error);
      addToast('删除失败', 'error');
      fetchData();
    } finally {
      setDeletingIds([]);
      setDeleteLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="sticky top-0 z-30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4 px-6 bg-[var(--bg-header)]/90 backdrop-blur-md border-b border-[var(--border-color)] transition-all duration-300">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">我的发布</h2>
          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] font-mono border border-[var(--border-color)]">
            {total} 张
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setCurrentPage(1)}
              placeholder="搜索..."
              className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-sm pl-9 pr-4 py-2 rounded-lg border border-[var(--border-color)] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all placeholder-gray-500"
            />
          </div>
          
          <button
             onClick={() => navigate('/dashboard/upload')}
             className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shadow-lg shadow-primary/20"
          >
            <UploadCloud size={16} />
            上传图片
          </button>
        </div>
      </div>

      {/* Select All Checkbox */}
      {pictures.length > 0 && (
        <div className="px-6 py-2 flex items-center gap-2">
          <div
            className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedIds.length === pictures.length && pictures.length > 0 ? 'bg-primary border-primary' : 'border-white/20'}`}
            onClick={handleSelectAll}
          >
            {selectedIds.length === pictures.length && pictures.length > 0 && <div className="w-2 h-2 bg-white rounded-sm" />}
          </div>
          <span className="text-xs text-gray-400 select-none cursor-pointer" onClick={handleSelectAll}>全选本页</span>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide px-6">
        <MyImageGrid
          loading={loading}
          pictures={pictures}
          selectedIds={selectedIds}
          deletingIds={deletingIds}
          onSelect={handleSelect}
          onClick={handleImageClick}
        />

        {/* Pagination */}
        {!loading && total > pageSize && (
          <div className="flex justify-center py-8 gap-2 items-center">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg disabled:opacity-30 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm transition-colors"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-[var(--text-secondary)] text-sm font-medium">
              {currentPage} / {Math.ceil(total / pageSize)}
            </span>
            <button
              disabled={currentPage >= Math.ceil(total / pageSize)}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg disabled:opacity-30 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      <BatchActionBar
        selectedCount={selectedIds.length}
        onDelete={handleBatchDeleteClick}
        onCancel={() => setSelectedIds([])}
        loading={loading || deleteLoading}
        // Hide approve/reject buttons
        onApprove={() => {}}
        onReject={() => {}}
        hideReview
      />

      <AlbumImageDetailModal
        picture={detailPicture}
        userNameMap={userMap}
        onClose={() => setDetailPicture(null)}
        onPrev={detailIndex > 0 ? handleDetailPrev : undefined}
        onNext={detailIndex < pictures.length - 1 ? handleDetailNext : undefined}
        onUpdate={(updatedPicture) => {
          setDetailPicture(updatedPicture);
          setPictures(prev => prev.map(p => p.id === updatedPicture.id ? updatedPicture : p));
        }}
        onDelete={handleDetailDelete}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        count={selectedIds.length}
        loading={deleteLoading}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  );
};

export default MyPublicPicturesPage;
