import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Picture, PictureReviewStatus, PictureQueryRequest, PictureReviewBatchRequest, PictureReviewSingleRequest, PictureDeleteBatchRequest } from '../../types/picture';
import { listPictureByPage, doPictureReview, doPictureReviewBatch, deletePicture, deletePictureBatch } from '../../services/picture';
import { sendMessage } from '../../services/message';
import { useUserMapStore } from '../../stores/userMap';
import FilterHeader from './FilterHeader';
import ImageGrid from './ImageGrid';
import BatchActionBar from './BatchActionBar';
import ReviewModal from './ReviewModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { useToastStore } from '../../stores/toastStore';

const PictureManagePage: React.FC = () => {
  // Data State
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Filter State
  const [filterStatus, setFilterStatus] = useState<PictureReviewStatus | null>(null);
  const [searchText, setSearchText] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal State
  const [reviewModalPicture, setReviewModalPicture] = useState<Picture | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const userMap = useUserMapStore((state) => state.userMap);
  const addToast = useToastStore((state) => state.addToast);

  // --- Data Fetching ---
  const fetchData = useCallback(async (isRefresh = false) => {
    setLoading(true);
    // Simulate network delay for realism
    const delay = new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 200));

    const request: PictureQueryRequest = {
      current: isRefresh ? 1 : currentPage,
      pageSize,
      sortField: 'createTime',
      sortOrder: 'descend',
      searchText: searchText || undefined,
      reviewStatus: filterStatus === null ? undefined : filterStatus,
      nullSpaceId: true, // Assuming we manage public/main pool, or modify based on requirements
    };

    try {
      const [res] = await Promise.all([listPictureByPage(request), delay]);
      if (res) {
        setPictures(res.records);
        setTotal(res.total);
        if (isRefresh) setCurrentPage(1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const ids: Array<string | undefined> = [];
    for (const p of pictures) {
      if (!p.user?.userName) ids.push(p.userId);
      if (p.reviewerId && !p.reviewerName) ids.push(p.reviewerId);
    }
    if (ids.length === 0) return;

    // Using store to fetch users
    useUserMapStore.getState().fetchUsers(ids.filter((id): id is string => !!id));
  }, [pictures]);

  // --- Handlers ---

  const handleRefresh = () => {
    fetchData(true);
    setSelectedIds([]);
    setDeletingIds([]);
  };

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

  const handleBatchReview = async (status: PictureReviewStatus) => {
    if (selectedIds.length === 0) return;

    // Optimistic Update or Loading?
    // Let's do loading simulation
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const req: PictureReviewBatchRequest = {
      idList: selectedIds,
      reviewStatus: status,
      reviewMessage: status === PictureReviewStatus.PASS ? '批量通过' : '批量拒绝'
    };

    const success = await doPictureReviewBatch(req);
    if (success) {
      // 发送消息通知
      const messagePromises = selectedIds.map(id => {
        const p = pictures.find(pic => pic.id === id);
        if (!p) return Promise.resolve(true);
        return sendMessage({
          receiveUserId: p.userId,
          title: status === PictureReviewStatus.PASS ? '图片审核通过' : '图片审核未通过',
          content: status === PictureReviewStatus.PASS
            ? `您上传的图片 [${p.name}] 已通过审核`
            : `您上传的图片 [${p.name}] 未通过审核，原因：${req.reviewMessage}`
        });
      });
      await Promise.all(messagePromises);

      // Refresh to get updated statuses
      await fetchData();
      setSelectedIds([]);
    } else {
      setLoading(false);
      addToast('操作失败', 'error');
    }
  };

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

    await new Promise(resolve => setTimeout(resolve, 200));

    setPictures((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    setTotal((prev) => Math.max(0, prev - idsToDelete.length));
    setSelectedIds([]);
    setDeletingIds([]);
    setDeleteLoading(false);

    let success = false;
    if (idsToDelete.length === 1) {
      success = await deletePicture({ id: idsToDelete[0] });
    } else {
      success = await deletePictureBatch({ ids: idsToDelete });
    }

    if (!success) {
      await fetchData();
      addToast('删除失败，请刷新后重试', 'error');
    }
  };

  const handleSingleReviewSubmit = async (id: string, status: PictureReviewStatus, message: string) => {
    // Artificial delay inside modal is handled by submitting state there, but we need to call API
    await new Promise(resolve => setTimeout(resolve, 600));

    const req: PictureReviewSingleRequest = {
      id,
      reviewStatus: status,
      reviewMessage: message
    };

    const success = await doPictureReview(req);
    if (success) {
      // 发送消息通知
      const picture = pictures.find(p => p.id === id);
      if (picture) {
        await sendMessage({
          receiveUserId: picture.userId,
          title: status === PictureReviewStatus.PASS ? '图片审核通过' : '图片审核未通过',
          content: status === PictureReviewStatus.PASS
            ? `您上传的图片 [${picture.name}] 已通过审核`
            : `您上传的图片 [${picture.name}] 未通过审核，原因：${message}`
        });
      }

      setReviewModalPicture(null);
      fetchData(); // Refresh list
    } else {
      addToast('审核提交失败', 'error');
    }
  };

  const reviewIndex = useMemo(() => {
    if (!reviewModalPicture) return -1;
    return pictures.findIndex(p => p.id === reviewModalPicture.id);
  }, [reviewModalPicture, pictures]);

  const handleReviewPrev = () => {
    if (reviewIndex > 0) {
      setReviewModalPicture(pictures[reviewIndex - 1]);
    }
  };

  const handleReviewNext = () => {
    if (reviewIndex !== -1 && reviewIndex < pictures.length - 1) {
      setReviewModalPicture(pictures[reviewIndex + 1]);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <FilterHeader
        status={filterStatus}
        onStatusChange={(s) => { setFilterStatus(s); setCurrentPage(1); }}
        searchText={searchText}
        onSearchChange={(t) => { setSearchText(t); setCurrentPage(1); }} // Should debounce in real app
        onRefresh={handleRefresh}
        loading={loading}
        total={total}
      />

      {/* Select All Checkbox (Optional helper above grid) */}
      {pictures.length > 0 && (
        <div className="px-1 py-2 flex items-center gap-2">
          <div
            className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedIds.length === pictures.length && pictures.length > 0 ? 'bg-primary border-primary' : 'border-white/20'}`}
            onClick={handleSelectAll}
          >
            {selectedIds.length === pictures.length && pictures.length > 0 && <div className="w-2 h-2 bg-white rounded-sm" />}
          </div>
          <span className="text-xs text-gray-400 select-none cursor-pointer" onClick={handleSelectAll}>全选本页</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
        <ImageGrid
          loading={loading}
          pictures={pictures}
          selectedIds={selectedIds}
          deletingIds={deletingIds}
          onSelect={handleSelect}
          onReviewClick={setReviewModalPicture}
        />

        {/* Pagination (Simple) */}
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
        onApprove={() => handleBatchReview(PictureReviewStatus.PASS)}
        onReject={() => handleBatchReview(PictureReviewStatus.REJECT)}
        onDelete={handleBatchDeleteClick}
        onCancel={() => setSelectedIds([])}
        loading={loading || deleteLoading}
      />

      {reviewModalPicture && (
        <ReviewModal
          picture={reviewModalPicture}
          userNameMap={userMap}
          onClose={() => setReviewModalPicture(null)}
          onSubmit={handleSingleReviewSubmit}
          onPrev={reviewIndex > 0 ? handleReviewPrev : undefined}
          onNext={reviewIndex < pictures.length - 1 ? handleReviewNext : undefined}
        />
      )}

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

export default PictureManagePage;
