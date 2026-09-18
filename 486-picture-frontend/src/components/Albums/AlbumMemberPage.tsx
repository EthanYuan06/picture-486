import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { Space, SpaceType } from '../../types/space';
import { SpaceRole } from '../../types/spaceUser';
import { getSpaceById } from '../../services/space';
import { getSpaceUser } from '../../services/spaceUser';
import { useAuthStore } from '../../stores/auth';
import SpaceMemberManage from './SpaceMemberManage';

interface AlbumMemberPageProps {
  id: string;
  onBack: () => void;
}

const AlbumMemberPage: React.FC<AlbumMemberPageProps> = ({ id, onBack }) => {
  const [album, setAlbum] = useState<Space | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userInfo = useAuthStore((s) => s.userInfo);

  const fetchAlbum = async () => {
    try {
      setLoading(true);
      const data = await getSpaceById(id);
      setAlbum(data);

      // If team space and user is logged in, fetch role
      if (data.spaceType === SpaceType.TEAM && userInfo) {
        try {
          const roleData = await getSpaceUser({ spaceId: id, userId: String(userInfo.id) });
          if (roleData) {
            setMyRole(roleData.spaceRole);
          }
        } catch (e) {
          // Ignore error (user might not be a member)
          console.log('User is not a member or error fetching role');
        }
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || '获取相册信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAlbum();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="text-red-500" size={48} />
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">无法加载相册信息</h2>
        <p className="text-[var(--text-secondary)]">{error}</p>
        <button onClick={onBack} className="px-6 py-2 bg-[var(--bg-hover)] rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
          返回
        </button>
      </div>
    );
  }

  // Permission Logic
  const isSystemAdmin = userInfo?.roles?.includes('admin');
  const isOwner = userInfo && String(album.userId) === String(userInfo.id);
  const isSpaceAdmin = myRole === SpaceRole.ADMIN;
  
  // Can manage members: System Admin, Owner, Space Admin
  const canManageMembers = isSystemAdmin || isOwner || isSpaceAdmin;

  if (album.spaceType !== SpaceType.TEAM) {
     return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">该相册不是团队相册</h2>
            <button onClick={onBack} className="px-6 py-2 bg-[var(--bg-hover)] rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
            返回
            </button>
        </div>
     );
  }

  return (
    <div className="w-full h-full flex flex-col relative overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 p-6 pb-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">成员信息</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 pt-0 max-w-4xl mx-auto w-full space-y-8">
         <div className="w-full">
            <SpaceMemberManage
                spaceId={album.id}
                isOwnerOrAdmin={!!canManageMembers}
            />
        </div>
      </div>
    </div>
  );
};

export default AlbumMemberPage;
