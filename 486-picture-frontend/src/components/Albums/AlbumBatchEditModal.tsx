import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { getPictureTagCategory } from '../../services/picture';
import PortalSelect, { SelectOption } from '../PortalSelect';

interface AlbumBatchEditModalProps {
  open: boolean;
  loading?: boolean;
  selectedCount: number;
  canEditName: boolean;
  onClose: () => void;
  onSubmit: (payload: { name?: string; category?: string; tags?: string[]; nameRule?: string }) => void | Promise<void>;
}

const AlbumBatchEditModal: React.FC<AlbumBatchEditModalProps> = ({
  open,
  loading,
  selectedCount,
  canEditName,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [nameRule, setNameRule] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const categoryOptions: SelectOption<string>[] = useMemo(() => {
    const opts = categories.map(c => ({ value: c, label: c }));
    return [{ value: '', label: '不修改' }, ...opts];
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    getPictureTagCategory().then((res) => {
      if (res?.categoryList) setCategories(res.categoryList);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);


  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setNameRule('');
    setCategory('');
    setTags([]);
    setTagInput('');
  }, [open, selectedCount, canEditName]);

  const disabled = !!loading || selectedCount === 0;
  const hasChange = (canEditName && name.trim().length > 0) || !!category || tags.length > 0 || nameRule.trim().length > 0;

  const description = useMemo(() => {
    if (selectedCount === 0) return '请先选择要编辑的图片。';
    if (selectedCount === 1) return '将修改所选图片的信息。';
    return '将批量修改所选图片的分类信息。';
  }, [selectedCount]);

  // Tag Handlers
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const t = tagInput.trim();
        if (t && !tags.includes(t)) {
            setTags([...tags, t]);
            setTagInput('');
        }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
        setTags(prev => prev.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
      setTags(tags.filter(t => t !== tagToRemove));
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[92vw] max-w-[520px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl shadow-black/20 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-8 pt-8 pb-7 relative flex-shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={18} />
            </button>

            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/25">
              <Pencil className="text-primary" size={20} />
            </div>

            <div className="text-center">
              <div className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
                编辑图片信息
              </div>
              <div className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">{description}</div>
            </div>
          </div>

          <div className="px-8 pb-2 space-y-5 overflow-y-auto scrollbar-hide">
            {/* Batch Name Rule Input - First item when batch editing */}
            {!canEditName && selectedCount > 1 && (
              <div>
                <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">批量编辑名称</div>
                <input
                  value={nameRule}
                  onChange={(e) => setNameRule(e.target.value)}
                  placeholder="请输入前缀名称，保存后批量添加序号"
                  className="w-full h-11 rounded-xl bg-[var(--bg-hover)] text-[14px] text-[var(--text-primary)] ring-1 ring-[var(--border-color)] px-4 outline-none focus:ring-primary/40 transition-all placeholder:text-[var(--text-secondary)]/50"
                />
              </div>
            )}

            {canEditName && (
              <div>
                <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">图片名称</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入图片名称"
                  className="w-full h-11 rounded-xl bg-[var(--bg-hover)] text-[14px] text-[var(--text-primary)] ring-1 ring-[var(--border-color)] px-4 outline-none focus:ring-primary/40 transition-all placeholder:text-[var(--text-secondary)]/50"
                />
              </div>
            )}

            <div className="relative">
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">分类</div>
              
              <PortalSelect<string>
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                placeholder="不修改"
                triggerClassName="bg-[var(--bg-hover)] h-11 border-transparent ring-1 ring-[var(--border-color)] hover:border-primary/50"
              />
            </div>

            <div>
                <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">标签</div>
                <div 
                    className="w-full min-h-[44px] rounded-xl bg-[var(--bg-hover)] ring-1 ring-[var(--border-color)] px-3 py-2 outline-none focus-within:ring-primary/40 transition-all flex flex-wrap gap-2 cursor-text"
                    onClick={() => document.getElementById('tag-input')?.focus()}
                >
                    {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium border border-primary/20">
                            {tag}
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                                className="hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    <input
                        id="tag-input"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagInputKeyDown}
                        placeholder={tags.length === 0 ? "输入标签按回车添加..." : ""}
                        className="flex-1 bg-transparent border-none outline-none text-[14px] text-[var(--text-primary)] min-w-[80px] placeholder:text-[var(--text-secondary)]/50 h-6"
                    />
                </div>
            </div>
          </div>

          <div className="px-8 pb-8 pt-6 flex items-center gap-4 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-xl bg-[var(--bg-hover)] text-[14px] font-semibold text-[var(--text-secondary)] ring-1 ring-[var(--border-color)] transition-all duration-200 hover:bg-[var(--bg-hover)]/80 hover:text-[var(--text-primary)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>

            <button
              onClick={() => onSubmit({ 
                  name: name.trim() ? name.trim() : undefined, 
                  category: category || undefined,
                  tags: tags.length > 0 ? tags : undefined,
                  nameRule: nameRule.trim() ? nameRule.trim() : undefined
              })}
              disabled={disabled || !hasChange}
              className="flex-1 h-11 rounded-xl bg-gradient-to-b from-[#6217d7] to-[#4e12ac] text-[14px] font-semibold text-white shadow-lg shadow-purple-900/25 transition-all duration-200 hover:from-[#6f22e6] hover:to-[#4e12ac] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              )}
              <span>{loading ? '保存中...' : '保存'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AlbumBatchEditModal;
