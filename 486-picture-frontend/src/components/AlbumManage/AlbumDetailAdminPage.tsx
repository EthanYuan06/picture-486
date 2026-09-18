import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSpaceByIdAdmin } from '../../services/space';
import { Space } from '../../types/space';
import { ArrowLeft, HardDrive, Image as ImageIcon, Calendar, User } from 'lucide-react';
import { formatSize } from '../../utils/file';
import { formatDate } from '../../utils/date';
import { useToastStore } from '../../stores/toastStore';

interface AlbumDetailAdminPageProps {
  id?: string;
}

const AlbumDetailAdminPage: React.FC<AlbumDetailAdminPageProps> = ({ id: propId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;
  const navigate = useNavigate();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    const fetchSpace = async () => {
      if (!id) return;
      try {
        const data = await getSpaceByIdAdmin(id);
        setSpace(data);
      } catch (error: any) {
        addToast(error.message || '获取相册详情失败', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSpace();
  }, [id, addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        加载中...
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-secondary)]">
        <p>未找到相册信息</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6 w-fit"
      >
        <ArrowLeft size={20} />
        <span>返回列表</span>
      </button>

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[var(--border-color)]">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{space.spaceName}</h1>
          <p className="text-[var(--text-secondary)] text-sm font-mono">ID: {space.id}</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">基本信息</h3>
              <div className="grid grid-cols-[24px_1fr] gap-3 text-sm">
                <User size={18} className="text-primary" />
                <div>
                  <span className="text-[var(--text-secondary)]">创建者: </span>
                  <span className="text-[var(--text-primary)] font-medium">{space.user?.userName || 'Unknown'} (ID: {space.userId})</span>
                </div>
                
                <Calendar size={18} className="text-primary" />
                <div>
                  <span className="text-[var(--text-secondary)]">创建时间: </span>
                  <span className="text-[var(--text-primary)]">{formatDate(space.createTime)}</span>
                </div>

                <div className="w-[18px]" />
                <div>
                  <span className="text-[var(--text-secondary)]">更新时间: </span>
                  <span className="text-[var(--text-primary)]">{formatDate(space.updateTime)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">相册描述</h3>
              <p className="text-[var(--text-primary)] bg-[var(--bg-hover)] p-3 rounded-lg text-sm leading-relaxed">
                {space.spaceDesc || '暂无描述'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">资源使用</h3>
              <div className="space-y-4">
                <div className="bg-[var(--bg-hover)] p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive size={18} className="text-blue-400" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">存储空间</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text-secondary)]">{formatSize(space.totalSize)} / {formatSize(space.maxSize)}</span>
                    <span className="text-[var(--text-primary)]">{((space.totalSize / space.maxSize) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((space.totalSize / space.maxSize) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-[var(--bg-hover)] p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon size={18} className="text-purple-400" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">图片数量</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text-secondary)]">{space.totalCount} / {space.maxCount}</span>
                    <span className="text-[var(--text-primary)]">{((space.totalCount / space.maxCount) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((space.totalCount / space.maxCount) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailAdminPage;
