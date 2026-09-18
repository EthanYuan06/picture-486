import React, { useState, useEffect } from 'react';
import { Space, SpaceLevelOption, SpaceType } from '../../types/space';
import { updateSpaceAdmin, listSpaceLevels } from '../../services/space';
import { useToastStore } from '../../stores/toastStore';
import PortalSelect, { SelectOption } from '../PortalSelect';
import { X } from 'lucide-react';
import { formatSize } from '../../utils/file';

interface EditSpaceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  space: Space | null;
}

const EditSpaceModal: React.FC<EditSpaceModalProps> = ({ open, onClose, onSuccess, space }) => {
  const [spaceName, setSpaceName] = useState('');
  const [spaceLevel, setSpaceLevel] = useState<number | null>(null);
  const [spaceType, setSpaceType] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<SpaceLevelOption[]>([]);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    if (open && space) {
      setSpaceName(space.spaceName);
      setSpaceLevel(space.spaceLevel);
      setSpaceType(space.spaceType ?? SpaceType.PRIVATE);
      fetchLevels();
    }
  }, [open, space]);

  const fetchLevels = async () => {
    try {
      const data = await listSpaceLevels();
      setLevels(data);
    } catch (error) {
      console.error(error);
      addToast('获取相册等级失败', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space) return;

    setLoading(true);
    try {
      await updateSpaceAdmin({
        id: space.id,
        spaceName,
        spaceLevel: spaceLevel ?? undefined,
        spaceType: spaceType ?? undefined,
      });
      addToast('更新成功', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      addToast(error.message || '更新失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const levelOptions: SelectOption<number>[] = levels.map(l => ({
    value: l.value,
    label: l.text,
  }));

  const selectedLevel = levels.find(l => l.value === spaceLevel);

  const typeOptions: SelectOption<number>[] = [
    { value: SpaceType.PRIVATE, label: '个人相册' },
    { value: SpaceType.TEAM, label: '多人相册' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">编辑相册</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              相册名称
            </label>
            <input
              type="text"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              相册类型
            </label>
            <PortalSelect<number>
              value={spaceType}
              onChange={setSpaceType}
              options={typeOptions}
              placeholder="选择类型"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              相册等级
            </label>
            <PortalSelect<number>
              value={spaceLevel}
              onChange={setSpaceLevel}
              options={levelOptions}
              placeholder="选择等级"
            />
            {selectedLevel && (
              <div className="mt-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] p-2 rounded border border-[var(--border-color)]">
                <p>最大容量: {formatSize(selectedLevel.maxSize)}</p>
                <p>最大数量: {selectedLevel.maxCount}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSpaceModal;
