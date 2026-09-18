import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Space, SpaceLevel, SpaceQueryRequest, SpaceType } from '../../types/space';
import { listSpaceByPage, deleteSpace } from '../../services/space';
import { Trash2, ExternalLink, Search, Edit } from 'lucide-react';
import PortalSelect, { SelectOption } from '../PortalSelect';
import DeleteConfirmModal from './DeleteConfirmModal';
import EditSpaceModal from './EditSpaceModal';
import { formatDate } from '../../utils/date';
import { useToastStore } from '../../stores/toastStore';
import { useUserMapStore } from '../../stores/userMap';
import { useNavigate } from 'react-router-dom';

const AlbumManagePage: React.FC = () => {
  const [albums, setAlbums] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();

  const userMap = useUserMapStore((state) => state.userMap);
  const fetchUsers = useUserMapStore((state) => state.fetchUsers);

  // Filters (Input State)
  const [filterUserId, setFilterUserId] = useState('');
  const [filterSpaceName, setFilterSpaceName] = useState('');
  const [filterSpaceLevel, setFilterSpaceLevel] = useState<number | null>(null);
  const [filterSpaceType, setFilterSpaceType] = useState<number | null>(null);

  // Query State (Applied Filters)
  const queryRef = useRef<SpaceQueryRequest>({});

  // Actions
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Space | null>(null);
  const [albumToEdit, setAlbumToEdit] = useState<Space | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const request: SpaceQueryRequest = {
      current: currentPage,
      pageSize,
      ...queryRef.current
    };

    try {
      const res = await listSpaceByPage(request);
      if (res) {
        setAlbums(res.records);
        setTotal(res.total);
        // Fetch user names
        const userIds = res.records.map(space => space.userId).filter(Boolean);
        if (userIds.length > 0) {
          fetchUsers(userIds);
        }
      }
    } catch (err) {
      console.error(err);
      addToast('获取相册列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, addToast, fetchUsers]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    const query = {
      userId: filterUserId || null,
      spaceName: filterSpaceName || null,
      spaceLevel: filterSpaceLevel !== null ? filterSpaceLevel : null,
      spaceType: filterSpaceType !== null ? filterSpaceType : null,
    };
    queryRef.current = query;
    setCurrentPage(1);
    fetchData();
  };

  const handleLevelChange = (val: number | null) => {
    setFilterSpaceLevel(val);
    // Use current state for other filters, but new value for level
    const query = {
      userId: filterUserId || null,
      spaceName: filterSpaceName || null,
      spaceLevel: val !== null ? val : null,
      spaceType: filterSpaceType !== null ? filterSpaceType : null,
    };
    queryRef.current = query;
    setCurrentPage(1);
    setLoading(true);
    listSpaceByPage({ ...query, current: 1, pageSize }).then(res => {
      if (res) {
        setAlbums(res.records);
        setTotal(res.total);
        const userIds = res.records.map(space => space.userId).filter(Boolean);
        if (userIds.length > 0) {
          fetchUsers(userIds);
        }
      }
    }).catch(err => {
      console.error(err);
      addToast('获取相册列表失败', 'error');
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleTypeChange = (val: number | null) => {
    setFilterSpaceType(val);
    const query = {
      userId: filterUserId || null,
      spaceName: filterSpaceName || null,
      spaceLevel: filterSpaceLevel !== null ? filterSpaceLevel : null,
      spaceType: val !== null ? val : null,
    };
    queryRef.current = query;
    setCurrentPage(1);
    setLoading(true);
    listSpaceByPage({ ...query, current: 1, pageSize }).then(res => {
      if (res) {
        setAlbums(res.records);
        setTotal(res.total);
        const userIds = res.records.map(space => space.userId).filter(Boolean);
        if (userIds.length > 0) {
          fetchUsers(userIds);
        }
      }
    }).catch(err => {
      console.error(err);
      addToast('获取相册列表失败', 'error');
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleDeleteClick = (album: Space) => {
    setAlbumToDelete(album);
    setDeleteModalOpen(true);
  };

  const handleEditClick = (album: Space) => {
    setAlbumToEdit(album);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    fetchData();
  };

  const handleDeleteConfirm = async () => {
    if (!albumToDelete) return;
    setDeleteLoading(true);
    try {
      const success = await deleteSpace(albumToDelete.id);
      if (success) {
        setDeleteModalOpen(false);
        setAlbumToDelete(null);
        addToast('删除成功', 'success');
        fetchData(); // Refresh list
      }
    } catch (error: any) {
        addToast(error.message || '删除失败', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const levelOptions: SelectOption<number | null>[] = useMemo(() => [
    { value: null, label: '全部等级' },
    { value: SpaceLevel.COMMON, label: '普通版' },
    { value: SpaceLevel.PROFESSIONAL, label: '专业版' },
    { value: SpaceLevel.FLAGSHIP, label: '旗舰版' },
  ], []);

  const spaceTypeOptions: SelectOption<number | null>[] = useMemo(() => [
    { value: null, label: '全部类型' },
    { value: SpaceType.PRIVATE, label: '个人相册' },
    { value: SpaceType.TEAM, label: '多人相册' },
  ], []);

  const getLevelBadge = (level: number) => {
    switch (level) {
      case SpaceLevel.COMMON:
        return <span className="text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded text-xs ml-2">普通版</span>;
      case SpaceLevel.PROFESSIONAL:
        return <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-xs ml-2">专业版</span>;
      case SpaceLevel.FLAGSHIP:
        return <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-xs ml-2">旗舰版</span>;
      default:
        return <span className="text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded text-xs ml-2">未知</span>;
    }
  };

  const getSpaceTypeBadge = (type: number) => {
    if (type === SpaceType.TEAM) {
      return <span className="text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-xs ml-2">多人</span>;
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Filter Header */}
      <div className="flex flex-col gap-4 p-4 bg-[var(--bg-header)]/90 backdrop-blur-md border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">相册管理</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            type="text"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="用户ID"
            className="bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            type="text"
            value={filterSpaceName}
            onChange={(e) => setFilterSpaceName(e.target.value)}
            placeholder="相册名称"
            className="bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="min-w-[120px]">
            <PortalSelect<number | null>
              value={filterSpaceLevel}
              onChange={handleLevelChange}
              options={levelOptions}
              placeholder="等级筛选"
              triggerClassName="h-[38px]"
            />
          </div>
          <div className="min-w-[120px]">
            <PortalSelect<number | null>
              value={filterSpaceType}
              onChange={handleTypeChange}
              options={spaceTypeOptions}
              placeholder="类型筛选"
              triggerClassName="h-[38px]"
            />
          </div>
          <div className="flex-1"></div>
          <button
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-colors px-4"
          >
            <Search size={16} />
            <span>查询</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-hover)] border-b border-[var(--border-color)] text-[var(--text-secondary)] text-sm">
                <th className="p-4 font-medium align-middle">相册名称 / ID</th>
                <th className="p-4 font-medium align-middle">创建者 / ID</th>
                <th className="p-4 font-medium align-middle">创建时间</th>
                <th className="p-4 font-medium align-middle text-center w-[120px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading && albums.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--text-secondary)]">
                    加载中...
                  </td>
                </tr>
              ) : albums.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--text-secondary)]">
                    暂无数据
                  </td>
                </tr>
              ) : (
                albums.map(album => (
                  <tr key={album.id} className="group hover:bg-[var(--bg-hover)]/50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center">
                          <span className="font-medium text-[var(--text-primary)]">{album.spaceName || '未命名相册'}</span>
                          {getLevelBadge(album.spaceLevel)}
                          {getSpaceTypeBadge(album.spaceType || SpaceType.PRIVATE)}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] font-mono">ID: {album.id}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-[var(--text-primary)]">
                          {userMap[String(album.userId)] || album.user?.userName || '未知用户'}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] font-mono">
                          ID: {album.userId}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)]">
                      {album.createTime ? formatDate(album.createTime) : '-'}
                    </td>
                    <td className="p-4 align-middle text-center w-[120px]">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/album/${album.id}`)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="查看"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          onClick={() => handleEditClick(album)}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="编辑"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(album)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > pageSize && (
          <div className="flex justify-center py-6 gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg disabled:opacity-50 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm transition-colors"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-[var(--text-secondary)] text-sm flex items-center">
              {currentPage} / {Math.ceil(total / pageSize)}
            </span>
            <button
              disabled={currentPage >= Math.ceil(total / pageSize)}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg disabled:opacity-50 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="确认删除相册？"
        description={`确定要删除相册 "${albumToDelete?.spaceName}" (ID: ${albumToDelete?.id}) 吗？此操作不可恢复。`}
      />

      <EditSpaceModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        space={albumToEdit}
      />

    </div>
  );
};

export default AlbumManagePage;
