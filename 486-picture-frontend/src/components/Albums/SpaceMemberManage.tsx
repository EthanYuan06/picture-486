
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  MoreHorizontal,
  Shield,
  User as UserIcon,
  X,
  Loader2,
  Check
} from 'lucide-react';
import { SpaceUser } from '../../types/spaceUser';
import { addSpaceUser, deleteSpaceUser, listSpaceUser, editSpaceUser } from '../../services/spaceUser';
import { useToastStore } from '../../stores/toastStore';
import { formatDate } from '../../utils/date';
import PortalSelect, { SelectOption } from '../PortalSelect';
import MemberDeleteConfirmModal from './MemberDeleteConfirmModal';

interface SpaceMemberManageProps {
  spaceId: string;
  isOwnerOrAdmin: boolean;
}

const ROLES = [
  { value: 'viewer', label: '访客' },
  { value: 'editor', label: '编辑者' },
  { value: 'admin', label: '管理员' },
];

const SpaceMemberManage: React.FC<SpaceMemberManageProps> = ({ spaceId, isOwnerOrAdmin }) => {
  const [members, setMembers] = useState<SpaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<SpaceUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listSpaceUser({ spaceId });
      setMembers(data);
    } catch (error: any) {
      addToast(error.message || '获取成员列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [spaceId, addToast]);

  useEffect(() => {
    if (spaceId) {
      fetchMembers();
    }
  }, [spaceId, fetchMembers]);

  const handleRemoveMemberClick = (member: SpaceUser) => {
    setMemberToDelete(member);
    setDeleteModalOpen(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteSpaceUser(memberToDelete.id);
      addToast('移除成员成功', 'success');
      fetchMembers();
      setDeleteModalOpen(false);
      setMemberToDelete(null);
    } catch (error: any) {
      addToast(error.message || '移除成员失败', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await editSpaceUser({ id, spaceRole: newRole });
      addToast('修改角色成功', 'success');
      fetchMembers();
    } catch (error: any) {
      addToast(error.message || '修改角色失败', 'error');
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users className="text-primary" size={20} />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">团队成员</h3>
          <span className="text-sm text-[var(--text-secondary)]">({members.length})</span>
        </div>
        {isOwnerOrAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm font-medium transition-colors"
          >
            <UserPlus size={16} />
            添加成员
          </button>
        )}
      </div>

      <div className="divide-y divide-[var(--border-color)]">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">
            暂无成员
          </div>
        ) : (
          members.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-hover)]/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center overflow-hidden border border-[var(--border-color)]">
                  {member.user?.userAvatar ? (
                    <img src={member.user.userAvatar} alt={member.user.userName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="text-[var(--text-secondary)]" size={20} />
                  )}
                </div>
                <div>
                  <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                    {member.user?.userName || `User ${member.userId}`}
                    {member.spaceRole === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-0.5">
                        <Shield size={10} /> 管理员
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                    <span>ID: {member.userId}</span>
                    <span>·</span>
                    <span>加入时间: {formatDate(member.createTime)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isOwnerOrAdmin ? (
                  <>
                    <div className="w-24">
                      <PortalSelect
                        value={member.spaceRole}
                        onChange={(val) => handleRoleChange(member.id, val)}
                        options={ROLES}
                        triggerClassName="h-8 text-xs"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveMemberClick(member)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="移除成员"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-[var(--text-secondary)] px-3 py-1 bg-[var(--bg-hover)] rounded-full">
                    {ROLES.find(r => r.value === member.spaceRole)?.label || member.spaceRole}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {addModalOpen && (
        <AddMemberModal
          spaceId={spaceId}
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => {
            setAddModalOpen(false);
            fetchMembers();
          }}
        />
      )}

      {deleteModalOpen && memberToDelete && (
        <MemberDeleteConfirmModal
          open={deleteModalOpen}
          userName={memberToDelete.user?.userName || `User ${memberToDelete.userId}`}
          loading={deleteLoading}
          onClose={() => {
            setDeleteModalOpen(false);
            setMemberToDelete(null);
          }}
          onConfirm={confirmRemoveMember}
        />
      )}
    </div>
  );
};

interface AddMemberModalProps {
  spaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ spaceId, onClose, onSuccess }) => {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('viewer');
  const [submitting, setSubmitting] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const handleSubmit = async () => {
    if (!userId.trim()) {
      addToast('请输入用户ID', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await addSpaceUser({
        spaceId,
        userId: userId.trim(),
        spaceRole: role
      });
      addToast('添加成员成功', 'success');
      onSuccess();
    } catch (error: any) {
      addToast(error.message || '添加成员失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">添加成员</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">用户 ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none text-[var(--text-primary)]"
              placeholder="请输入用户 ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">角色</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all
                    ${role === r.value
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }
                  `}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !userId.trim()}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="animate-spin" size={16} />}
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpaceMemberManage;
