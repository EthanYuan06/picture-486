import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '../../types';
import { UserQueryRequest, listUserByPage, deleteUser, updateUser, UserUpdateRequest } from '../../services/user';
import { Edit, Trash2 } from 'lucide-react';
import PortalSelect, { SelectOption } from '../PortalSelect';
import UserEditModal from './UserEditModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { formatDate } from '../../utils/date';
import { useToastStore } from '../../stores/toastStore';
import { toWebpUrl } from '../../utils/image';

const UserManagePage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filters
  const [filterId, setFilterId] = useState('');
  const [filterUserName, setFilterUserName] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterRole, setFilterRole] = useState<string | null>(null);

  // Actions
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const request: UserQueryRequest = {
      current: currentPage,
      pageSize,
      sortField: 'createTime',
      sortOrder: 'descend',
      id: filterId || undefined,
      userName: filterUserName || undefined,
      userProfile: filterProfile || undefined,
      userEmail: filterEmail || undefined,
      userRole: filterRole || undefined,
    };

    try {
      const res = await listUserByPage(request);
      if (res) {
        setUsers(res.records);
        setTotal(res.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterId, filterUserName, filterProfile, filterEmail, filterRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteUserOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      const success = await deleteUser(userToDelete.id);
      if (success) {
        setDeleteUserOpen(false);
        setUserToDelete(null);
        fetchData(); // Refresh list
      } else {
        addToast('删除失败', 'error');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateUser = async (data: UserUpdateRequest) => {
    const success = await updateUser(data);
    if (success) {
      fetchData();
    } else {
      addToast('更新失败', 'error');
    }
  };

  const roleOptions: SelectOption<string | null>[] = useMemo(() => [
    { value: null, label: '全部角色' },
    { value: 'user', label: '普通用户' },
    { value: 'admin', label: '管理员' },
  ], []);

  return (
    <div className="h-full flex flex-col relative">
      {/* Filter Header */}
      <div className="flex flex-col gap-4 p-4 bg-[var(--bg-header)]/90 backdrop-blur-md border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">用户管理</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            placeholder="ID"
            className="bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            type="text"
            value={filterUserName}
            onChange={(e) => setFilterUserName(e.target.value)}
            placeholder="用户名"
            className="bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            type="text"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            placeholder="邮箱"
            className="bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            type="text"
            value={filterProfile}
            onChange={(e) => setFilterProfile(e.target.value)}
            placeholder="简介"
            className="bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="min-w-[120px]">
            <PortalSelect<string>
              value={filterRole}
              onChange={setFilterRole}
              options={roleOptions}
              placeholder="角色筛选"
              triggerClassName="h-[38px]"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-hover)] border-b border-[var(--border-color)] text-[var(--text-secondary)] text-sm">
                <th className="p-4 font-medium align-middle">用户</th>
                <th className="p-4 font-medium align-middle">账号/邮箱</th>
                <th className="p-4 font-medium align-middle">角色</th>
                <th className="p-4 font-medium align-middle text-center w-[300px]">简介</th>
                <th className="p-4 font-medium align-middle">注册时间</th>
                <th className="p-4 font-medium align-middle text-center w-[120px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--text-secondary)]">
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--text-secondary)]">
                    暂无数据
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="group hover:bg-[var(--bg-hover)]/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={(() => {
                            const originalSrc =
                              user.userAvatar || 'https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/icon/subarupic.ico';
                            const webpSrc = originalSrc.toLowerCase().endsWith('.ico') ? originalSrc : toWebpUrl(originalSrc);
                            return webpSrc || originalSrc;
                          })()}
                          alt={user.userName}
                          className="w-10 h-10 rounded-full object-cover border border-[var(--border-color)]"
                          onError={(e) => {
                            const originalSrc =
                              user.userAvatar || 'https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/icon/subarupic.ico';
                            if (originalSrc && e.currentTarget.src !== originalSrc) {
                              e.currentTarget.src = originalSrc;
                            }
                          }}
                        />
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{user.userName || '未命名'}</div>
                          <div className="text-xs text-[var(--text-secondary)]">ID: {user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-[var(--text-primary)]">{user.userAccount}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{user.userEmail || '-'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${user.userRole === 'admin'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                        {user.userRole === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-center w-[300px]">
                      <div className="h-[60px] w-full flex items-center justify-center">
                        <div
                          className="text-sm text-[var(--text-secondary)] leading-5 overflow-hidden break-words text-center w-full"
                          style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                          title={user.userProfile}
                        >
                          {user.userProfile || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)]">
                      {user.createTime ? formatDate(user.createTime) : '-'}
                    </td>
                    <td className="p-4 align-middle text-center w-[120px]">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditUser(user)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="编辑"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
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

      {/* Modals */}
      {editUser && (
        <UserEditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSubmit={handleUpdateUser}
        />
      )}

      <DeleteConfirmModal
        open={deleteUserOpen}
        onClose={() => setDeleteUserOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="确认删除用户？"
        description={`确定要删除用户 "${userToDelete?.userName}" (ID: ${userToDelete?.id}) 吗？此操作不可恢复。`}
      />

    </div>
  );
};

export default UserManagePage;
