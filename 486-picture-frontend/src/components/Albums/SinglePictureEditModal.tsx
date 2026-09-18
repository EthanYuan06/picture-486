import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { getPictureTagCategory } from '../../services/picture';
import { Picture } from '../../types/picture';
import PortalSelect, { SelectOption } from '../PortalSelect';

interface SinglePictureEditModalProps {
  open: boolean;
  loading?: boolean;
  picture: Picture;
  onClose: () => void;
  onSubmit: (payload: { name?: string; introduction?: string; category?: string; tags?: string[] }) => void | Promise<void>;
}

const SinglePictureEditModal: React.FC<SinglePictureEditModalProps> = ({
  open,
  loading,
  picture,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const categoryOptions: SelectOption<string>[] = useMemo(() => {
    const opts = categories.map(c => ({ value: c, label: c }));
    return [{ value: '', label: '无分类' }, ...opts];
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    getPictureTagCategory().then((res) => {
      if (res?.categoryList) setCategories(res.categoryList);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(picture.name || '');
    setIntroduction(picture.introduction || '');
    setCategory(picture.category || '');
    // Handle tags: string | string[]
    let initTags: string[] = [];
    if (Array.isArray(picture.tags)) {
      initTags = picture.tags.map(String);
    } else if (typeof picture.tags === 'string') {
      try {
        const parsed = JSON.parse(picture.tags);
        if (Array.isArray(parsed)) initTags = parsed.map(String);
        else initTags = picture.tags.split(',').filter(Boolean);
      } catch {
        initTags = picture.tags.split(',').filter(Boolean);
      }
    }
    setTags(initTags);
    setTagInput('');
  }, [open, picture]);

  // KeyDown and ClickOutside
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

  // Scroll Lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const canSubmit = !!name.trim();

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

      <div className="absolute inset-0 flex items-start justify-center p-4 pt-20 md:pt-24">
        <div className="w-[92vw] max-w-[520px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl shadow-black/20 overflow-hidden flex flex-col max-h-[calc(100vh-7rem)]">
          {/* Header */}
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
              <div className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">修改图片的名称、分类、标签等信息</div>
            </div>
          </div>

          <div className="px-8 pb-2 space-y-5 overflow-y-auto scrollbar-hide">
            {/* Name */}
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">图片名称</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入图片名称"
                className="w-full h-11 rounded-xl bg-[var(--bg-hover)] text-[14px] text-[var(--text-primary)] ring-1 ring-[var(--border-color)] px-4 outline-none focus:ring-primary/40 transition-all placeholder:text-[var(--text-secondary)]/50"
              />
            </div>

            {/* Introduction */}
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">简介</div>
              <textarea
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="请输入图片简介"
                rows={3}
                className="w-full rounded-xl bg-[var(--bg-hover)] text-[14px] text-[var(--text-primary)] ring-1 ring-[var(--border-color)] px-4 py-3 outline-none focus:ring-primary/40 transition-all placeholder:text-[var(--text-secondary)]/50 resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">分类</div>
              <PortalSelect<string>
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                placeholder="选择分类"
                triggerClassName="bg-[var(--bg-hover)] h-11 border-transparent ring-1 ring-[var(--border-color)] hover:border-primary/50"
              />
            </div>

            {/* Tags */}
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">标签</div>
              <div
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-hover)] ring-1 ring-[var(--border-color)] px-3 py-2 outline-none focus-within:ring-primary/40 transition-all flex flex-wrap gap-2 cursor-text"
                onClick={() => document.getElementById('tag-input-single')?.focus()}
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
                  id="tag-input-single"
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
                name: name.trim(),
                introduction: introduction.trim(),
                category: category,
                tags: tags
              })}
              disabled={loading || !canSubmit}
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

export default SinglePictureEditModal;
