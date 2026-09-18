import React, { useMemo, useState } from 'react';
import { User } from '../../types';
import { X } from 'lucide-react';
import { UserUpdateRequest } from '../../services/user';
import PortalSelect, { SelectOption } from '../PortalSelect';

interface UserEditModalProps {
  user: User;
  onClose: () => void;
  onSubmit: (data: UserUpdateRequest) => Promise<void>;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<UserUpdateRequest>({
    id: user.id,
    userName: user.userName || '',
    userProfile: user.userProfile || '',
    userRole: user.userRole || 'user',
    userEmail: user.userEmail || '',
  });
  const [loading, setLoading] = useState(false);

  const roleOptions: SelectOption<string>[] = useMemo(
    () => [
      { value: 'user', label: '普通用户' },
      { value: 'admin', label: '管理员' },
    ],
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-card)] w-full max-w-md rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">编辑用户</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">用户名</label>
            <input
              type="text"
              value={formData.userName}
              onChange={e => setFormData({ ...formData, userName: e.target.value })}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">简介</label>
            <textarea
              value={formData.userProfile}
              onChange={e => setFormData({ ...formData, userProfile: e.target.value })}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/50 h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">角色</label>
            <PortalSelect
              value={String(formData.userRole || 'user')}
              onChange={(val) => setFormData({ ...formData, userRole: val })}
              options={roleOptions}
              placeholder="选择角色"
              triggerClassName="rounded-lg px-4 py-2 min-h-0 h-10 bg-[var(--input-bg)] hover:bg-[var(--input-bg)]"
            />
          </div>
        </form>

        <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-card)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserEditModal;
