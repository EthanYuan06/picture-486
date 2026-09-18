import React, { useState, useEffect } from 'react';
import { BookHeart, FolderPlus, X, Image as ImageIcon, Calendar, User, Users, Shield } from 'lucide-react';
import { Space, SpaceLevel, SpaceType } from '../../types/space';
import { addSpace, listSpaceVoByPage, getSpaceById } from '../../services/space';
import { listMyTeamSpaces } from '../../services/spaceUser';
import { formatDate } from '../../utils/date';
import { getCurrentLoginUser } from '../../services/user';
import { toWebpUrl } from '../../utils/image';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../stores/toastStore';
import PortalSelect, { SelectOption } from '../PortalSelect';

const AlbumsPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const [albums, setAlbums] = useState<Space[]>([]);
  const [joinedAlbums, setJoinedAlbums] = useState<Space[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumType, setNewAlbumType] = useState<SpaceType>(SpaceType.PRIVATE);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(1);
  const [total, setTotal] = useState(0);
  const [userId, setUserId] = useState<number | null>(null);
  const pageSize = 6;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentLoginUser();
        if (cancelled) return;
        setUserId(user?.id ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAlbums = async (nextCurrent?: number) => {
    const effectiveUserId = userId;
    const effectiveCurrent = nextCurrent ?? current;
    if (!effectiveUserId) return;
    try {
      setLoading(true);
      const res = await listSpaceVoByPage({
        current: effectiveCurrent,
        pageSize,
        userId: effectiveUserId,
      });
      setAlbums(res?.records ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setAlbums([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchJoinedAlbums = async () => {
    if (!userId) return;
    try {
      const spaceUsers = await listMyTeamSpaces();
      const spaceIds = spaceUsers.map(su => su.spaceId);
      if (spaceIds.length > 0) {
        // Parallel fetch details, handling potential errors for individual spaces
        const spaces = await Promise.all(
          spaceIds.map(id => getSpaceById(id).catch(() => null))
        );
        // Filter out nulls and spaces already in "My Albums" (if any overlap, though unlikely if userId filtering works as expected)
        const validSpaces = spaces.filter((s): s is Space => s !== null && String(s.userId) !== String(userId));
        setJoinedAlbums(validSpaces);
      } else {
        setJoinedAlbums([]);
      }
    } catch (e) {
      console.error("Failed to fetch joined albums", e);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchAlbums();
    fetchJoinedAlbums();
  }, [userId, current]);

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;

    try {
      await addSpace({
        spaceName: newAlbumName,
        spaceLevel: SpaceLevel.COMMON,
        spaceType: newAlbumType,
      });
      setNewAlbumName('');
      setNewAlbumType(SpaceType.PRIVATE);
      setIsCreateModalOpen(false);
      setCurrent(1);
      await fetchAlbums(1);
    } catch (error) {
      console.error('Failed to create album:', error);
      const msg = error instanceof Error && error.message ? error.message : '创建相册失败';
      addToast(msg, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateAlbum();
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case SpaceLevel.COMMON:
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case SpaceLevel.PROFESSIONAL:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case SpaceLevel.FLAGSHIP:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getSpaceTypeColor = (type: number) => {
    if (type === SpaceType.TEAM) {
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
    return '';
  };

  const getLevelName = (level: number) => {
    switch (level) {
      case SpaceLevel.COMMON:
        return '普通版';
      case SpaceLevel.PROFESSIONAL:
        return '专业版';
      case SpaceLevel.FLAGSHIP:
        return '旗舰版';
      default:
        return '未知';
    }
  };

  const getAlbumCoverUrl = (album: Space): string | null => {
    const a = album as unknown as Record<string, unknown>;
    const candidate = [a.spaceCover, a.coverUrl, a.cover, a.spaceAvatar].find((v) => typeof v === 'string');
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    return value.length > 0 ? value : null;
  };

  if (loading && albums.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canCreateAlbum = newAlbumName.trim().length > 0;

  const spaceTypeOptions: SelectOption<number>[] = [
    { value: SpaceType.PRIVATE, label: '个人相册' },
    { value: SpaceType.TEAM, label: '多人相册' },
  ];

  return (
    <div className="w-full h-full p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BookHeart className="text-primary" />
            我的相册库
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 tracking-wider uppercase">
            MANAGE YOUR VISUAL COLLECTIONS
          </p>
        </div>
        {albums.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#6217d7] hover:bg-[#4e12ac] text-[var(--on-primary)] rounded-full text-sm font-medium shadow-lg hover:shadow-primary/25 transition-all duration-300"
          >
            + 创建相册
          </button>
        )}
      </div>

      {/* Empty State */}
      {albums.length === 0 && joinedAlbums.length === 0 ? (
        <div className="h-[70vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-[#6217d7]/30 rounded-3xl blur-2xl group-hover:bg-[#6217d7]/40 transition-all duration-500"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-[#6217d7] to-[#8b5cf6] rounded-3xl shadow-[0_18px_55px_rgba(98,23,215,0.35)] flex items-center justify-center transform group-hover:scale-105 transition-all duration-500">
              <BookHeart size={40} className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">在这里创建你的第一个相册~</h2>
          <p className="text-[var(--text-secondary)] mb-8 text-center max-w-md">
            相册可以帮你更好分类管理美图，快来为它们建立一个家吧。
          </p>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-3 bg-gradient-to-r from-[#6217d7] to-[#8b5cf6] text-[var(--on-primary)] rounded-full font-medium shadow-[0_10px_30px_rgba(98,23,215,0.30)] hover:shadow-[0_14px_40px_rgba(98,23,215,0.40)] hover:-translate-y-0.5 transition-all duration-300"
          >
            + 立即创建相册
          </button>
        </div>
      ) : (
        <div className="space-y-12 min-h-[600px] pb-10">
          {/* My Albums */}
          {albums.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                <User size={18} className="text-primary" />
                我创建的相册
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {albums.map((album) => {
                  const originalCoverUrl = getAlbumCoverUrl(album);
                  const webpCoverUrl = originalCoverUrl ? toWebpUrl(originalCoverUrl) : '';
                  return (
                    <div
                      key={album.id}
                      onClick={() => navigate(`/album/${album.id}`)}
                      className="group relative bg-[var(--bg-card)] rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 border border-[var(--border-color)] hover:border-primary/30"
                    >
                      <div className="aspect-[2.2/1] overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                        {originalCoverUrl ? (
                          <img
                            src={webpCoverUrl || originalCoverUrl}
                            alt={album.spaceName}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => {
                              if (originalCoverUrl && e.currentTarget.src !== originalCoverUrl) {
                                e.currentTarget.src = originalCoverUrl;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-[var(--bg-hover)] flex items-center justify-center">
                            <ImageIcon size={40} className="text-[var(--text-secondary)] opacity-70" />
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 relative z-20 bg-[var(--bg-card)]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLevelColor(album.spaceLevel)}`}>
                            {getLevelName(album.spaceLevel)}
                          </span>
                          {album.spaceType === SpaceType.TEAM && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getSpaceTypeColor(album.spaceType)}`}>
                              多人
                            </span>
                          )}
                        </div>
                        <h3 className="text-[var(--text-primary)] font-medium truncate mb-1 text-lg group-hover:text-primary transition-colors">
                          {album.spaceName}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <ImageIcon size={12} />
                            <span>{album.totalCount} 张图片</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{formatDate(album.createTime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    type="button"
                    disabled={current <= 1 || loading}
                    onClick={() => setCurrent((c) => Math.max(1, c - 1))}
                    className="px-4 py-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primaryHover hover:to-purple-700 text-[var(--on-primary)] rounded-full text-sm font-medium shadow-lg hover:shadow-primary/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {current} / {totalPages}
                  </div>
                  <button
                    type="button"
                    disabled={current >= totalPages || loading}
                    onClick={() => setCurrent((c) => Math.min(totalPages, c + 1))}
                    className="px-4 py-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primaryHover hover:to-purple-700 text-[var(--on-primary)] rounded-full text-sm font-medium shadow-lg hover:shadow-primary/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Joined Albums */}
          {joinedAlbums.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                <Users size={18} className="text-purple-500" />
                我加入的相册
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedAlbums.map((album) => {
                  const originalCoverUrl = getAlbumCoverUrl(album);
                  const webpCoverUrl = originalCoverUrl ? toWebpUrl(originalCoverUrl) : '';
                  return (
                    <div
                      key={album.id}
                      onClick={() => navigate(`/album/${album.id}`)}
                      className="group relative bg-[var(--bg-card)] rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 border border-[var(--border-color)] hover:border-primary/30"
                    >
                      <div className="aspect-[2.2/1] overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                        {originalCoverUrl ? (
                          <img
                            src={webpCoverUrl || originalCoverUrl}
                            alt={album.spaceName}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => {
                              if (originalCoverUrl && e.currentTarget.src !== originalCoverUrl) {
                                e.currentTarget.src = originalCoverUrl;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-[var(--bg-hover)] flex items-center justify-center">
                            <ImageIcon size={40} className="text-[var(--text-secondary)] opacity-70" />
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 relative z-20 bg-[var(--bg-card)]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLevelColor(album.spaceLevel)}`}>
                            {getLevelName(album.spaceLevel)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-purple-500/10 text-purple-500 border-purple-500/20">
                            已加入
                          </span>
                        </div>
                        <h3 className="text-[var(--text-primary)] font-medium truncate mb-1 text-lg group-hover:text-primary transition-colors">
                          {album.spaceName}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <ImageIcon size={12} />
                            <span>{album.totalCount} 张图片</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User size={12} />
                            <span>{album.user?.userName || `User ${album.userId}`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Album Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCreateModalOpen(false)}
          ></div>

          <div className="relative w-full max-w-md bg-[var(--bg-card)] backdrop-blur-md border border-[var(--border-color)] rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/20 rounded-lg">
                <FolderPlus className="text-primary" size={24} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">新建相册</h3>
            </div>

            <p className="text-[var(--text-secondary)] text-sm mb-6">
              给你的新收藏起一个优雅的名字，好的名字能让回忆更有序。
            </p>

            <div className="mb-6">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                相册类型
              </label>
              <PortalSelect<number>
                value={newAlbumType}
                onChange={setNewAlbumType}
                options={spaceTypeOptions}
                triggerClassName="w-full bg-[var(--input-bg)]"
              />
            </div>

            <div className="mb-8">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                相册名称
              </label>
              <input
                autoFocus
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例如：2025年夏日旅行"
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium"
              >
                放弃
              </button>
              <button
                onClick={handleCreateAlbum}
                disabled={!canCreateAlbum}
                className={`px-6 py-2.5 rounded-full font-medium transition-all duration-300 text-sm ${canCreateAlbum
                  ? 'bg-[#6217d7] hover:bg-[#4e12ac] text-white shadow-[0_10px_30px_rgba(98,23,215,0.30)] hover:shadow-[0_14px_40px_rgba(98,23,215,0.40)]'
                  : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-color)] shadow-none opacity-100 cursor-not-allowed'
                  }`}
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumsPage;
