import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Tag,
  LayoutGrid,
  Search
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Picture, PictureQueryRequest } from '../types/picture';
import { listPictureVoByPage, getPictureTagCategory } from '../services/picture';
import { toWebpUrl } from '../utils/image';
import AlbumImageDetailModal from './Albums/AlbumImageDetailModal';
import { useUserMapStore } from '../stores/userMap';
import { useThemeStore } from '../stores/theme';

const HomePage: React.FC = () => {
  // Data State
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const pageSize = 20;
  const userMap = useUserMapStore((state) => state.userMap);
  const theme = useThemeStore((state) => state.theme);
  const isDarkTheme = theme === 'dark';

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Search Param
  const [searchParams] = useSearchParams();
  const searchText = searchParams.get('search') || '';

  // Detail Modal
  const [detailPicture, setDetailPicture] = useState<Picture | null>(null);

  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // Fetch Categories & Tags
  useEffect(() => {
    const fetchMeta = async () => {
      const res = await getPictureTagCategory();
      if (res) {
        setCategories(res.categoryList);
        setTags(res.tagList);
      }
    };
    fetchMeta();
  }, []);

  // Fetch Pictures
  const fetchPictures = useCallback(async (currentPage: number, isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetching(true);

    try {
      const queryParams: PictureQueryRequest = {
        current: currentPage,
        pageSize,
        sortField: 'createTime',
        sortOrder: 'desc',
        nullSpaceId: true,
        reviewStatus: 1,
      };

      if (selectedCategory) queryParams.category = selectedCategory;
      if (selectedTags.length > 0) queryParams.tags = selectedTags;
      if (searchText) queryParams.searchText = searchText;

      const res = await listPictureVoByPage(queryParams);

      if (res) {
        if (isRefresh) {
          setPictures(res.records);
        } else {
          setPictures(prev => [...prev, ...res.records]);
        }
        setHasMore(res.records.length === pageSize);
      } else {
        if (isRefresh) setPictures([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to fetch pictures:", error);
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
      setLoading(false);
    }
  }, [selectedCategory, selectedTags, searchText]);

  // Initial Fetch & Filter Change
  useEffect(() => {
    setLoading(true);
    setPictures([]);
    setPage(1);
    setHasMore(true);
    fetchPictures(1, true);
  }, [selectedCategory, selectedTags, searchText, fetchPictures]);

  // Fetch Users for Modal
  useEffect(() => {
    const ids: string[] = [];
    pictures.forEach(p => {
      if (p.userId && !p.user?.userName) ids.push(p.userId);
      if (p.reviewerId && !p.reviewerName) ids.push(p.reviewerId);
    });
    if (ids.length > 0) {
      useUserMapStore.getState().fetchUsers([...new Set(ids)]);
    }
  }, [pictures]);

  // Infinite Scroll
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
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetching, fetchPictures]);

  // Handlers
  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Detail Modal Navigation
  const detailIndex = pictures.findIndex(p => p.id === detailPicture?.id);
  const handleDetailPrev = () => {
    if (detailIndex > 0) setDetailPicture(pictures[detailIndex - 1]);
  };
  const handleDetailNext = () => {
    if (detailIndex !== -1 && detailIndex < pictures.length - 1) setDetailPicture(pictures[detailIndex + 1]);
  };

  return (
    <div className="min-h-full pb-12 space-y-8">
      {/* 1. Popular Categories (Horizontal Scroll) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold px-1 flex items-center gap-2">
          <LayoutGrid size={20} className="text-primary" />
          热门分类
        </h2>
        <div className="relative group">
          <div className="overflow-x-auto pb-4 px-1 scrollbar-hide flex gap-4 snap-x snap-mandatory">
            {/* 'All' Category */}
            <div
              onClick={() => setSelectedCategory(null)}
              className={`
                snap-start flex-shrink-0 w-48 h-28 rounded-2xl p-5 cursor-pointer transition-all duration-300
                border border-white/10 backdrop-blur-md relative overflow-hidden group/card
                ${selectedCategory === null
                  ? (isDarkTheme
                    ? 'bg-gradient-to-br from-primary to-purple-600 shadow-[0_8px_20px_rgba(98,23,215,0.3)] scale-[1.02]'
                    : 'bg-gradient-to-br from-primary/10 to-purple-200/80 shadow-[0_8px_20px_rgba(98,23,215,0.15)] scale-[1.02]'
                  )
                  : 'bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1'
                }
              `}
            >
              <div className="relative z-10 h-full flex flex-col justify-between text-[var(--text-primary)]">
                <span className="text-2xl font-bold">全部</span>
                <div className={`text-xs ${selectedCategory === null && isDarkTheme ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>查看所有图片</div>
              </div>
              {/* Decorative Circle */}
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl transition-all duration-500
                ${selectedCategory === null ? 'bg-white/20' : 'bg-primary/20 group-hover/card:bg-primary/30'}
              `} />
            </div>

            {categories.map((cat, index) => (
              <div
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`
                  snap-start flex-shrink-0 w-48 h-28 rounded-2xl p-5 cursor-pointer transition-all duration-300
                  border border-white/10 backdrop-blur-md relative overflow-hidden group/card
                  ${selectedCategory === cat
                    ? (isDarkTheme
                      ? 'bg-gradient-to-br from-primary to-purple-600 shadow-[0_8px_20px_rgba(98,23,215,0.3)] scale-[1.02]'
                      : 'bg-gradient-to-br from-primary/10 to-purple-200/80 shadow-[0_8px_20px_rgba(98,23,215,0.15)] scale-[1.02]'
                    )
                    : 'bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1'
                  }
                `}
                style={{
                  // Asymmetric shapes variation
                  borderTopRightRadius: index % 2 === 0 ? '3rem' : '1rem',
                  borderBottomLeftRadius: index % 2 !== 0 ? '3rem' : '1rem',
                }}
              >
                <div className="relative z-10 h-full flex flex-col justify-between text-[var(--text-primary)]">
                  <span className="text-xl font-bold truncate">{cat}</span>
                  <div className={`text-xs ${selectedCategory === cat && isDarkTheme ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>Explore Category</div>
                </div>
                <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-all duration-500
                   ${selectedCategory === cat ? 'bg-white/20' : 'bg-primary/20 group-hover/card:bg-primary/30'}
                `} />
              </div>
            ))}
          </div>
          {/* Scroll Hint Gradient - Right */}
          <div className="absolute right-0 top-0 bottom-4 w-24 bg-gradient-to-l from-[var(--bg-main)] to-transparent pointer-events-none" />
        </div>
      </section>

      {/* 2. Popular Tags (Dynamic Tag Cloud) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold px-1 flex items-center gap-2">
          <Tag size={20} className="text-primary" />
          热门标签
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagToggle(tag)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border
                ${selectedTags.includes(tag)
                  ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(98,23,215,0.2)]'
                  : 'bg-white/5 text-[var(--text-secondary)] border-transparent hover:bg-white/10 hover:text-[var(--text-primary)]'
                }
              `}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Image Wall (200x200 Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Search size={20} className="text-primary" />
            探索发现
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,200px)] gap-4 justify-center">
          {pictures.map(pic => (
            <div
              key={pic.id}
              onClick={() => setDetailPicture(pic)}
              className="w-[200px] h-[200px] relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/20"
            >
              <img
                src={toWebpUrl(pic.url)}
                alt={pic.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              {/* Overlay reused from Album content page style */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-white font-medium text-sm truncate">{pic.name}</div>
                  <div className="text-white/60 text-xs mt-1 flex justify-between">
                    <span>{pic.picWidth}x{pic.picHeight}</span>
                    <span>{(pic.picSize / 1024 / 1024).toFixed(1)}MB</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading Sentinel */}
        <div ref={observerTarget} className="h-20 flex items-center justify-center py-8">
          {isFetching && hasMore && <Loader2 className="animate-spin text-primary" size={24} />}
          {!hasMore && pictures.length > 0 && (
            <div className="text-[var(--text-secondary)] text-sm flex items-center gap-2">
              <span className="w-12 h-px bg-white/10"></span>
              已经到底啦
              <span className="w-12 h-px bg-white/10"></span>
            </div>
          )}
          {!isFetching && pictures.length === 0 && !loading && (
            <div className="text-[var(--text-secondary)]">暂无图片</div>
          )}
        </div>
      </section>

      {/* Detail Modal */}
      <AlbumImageDetailModal
        picture={detailPicture}
        userNameMap={userMap}
        onClose={() => setDetailPicture(null)}
        onPrev={detailIndex > 0 ? handleDetailPrev : undefined}
        onNext={detailIndex < pictures.length - 1 ? handleDetailNext : undefined}
      />
    </div>
  );
};

export default HomePage;
