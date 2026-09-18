
import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Image as ImageIcon,
  UploadCloud,
  BookHeart,
  Images,
  Users,
  FolderCog,
  BarChart3,
  LogOut,
  User as UserIcon,
  ChevronDown,
  ChevronLeft,
  Search, // Added Search icon
  Share2
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ViewState } from '../types';
import { getCurrentLoginUser, postLogout } from '../services/user';
import { useAuthStore } from '../stores/auth';
import { useLayoutStore } from '../stores/layoutStore';
import { toWebpUrl } from '../utils/image';
import ThemeToggle from './ThemeToggle';
import MessageCenter from './Message/MessageCenter';
import PendingDev from './PendingDev';
import PictureManagePage from './PictureManage/PictureManagePage';
import MyPublicPicturesPage from './MyPublicPictures/MyPublicPicturesPage';
import ProfilePage from './ProfilePage';
import AlbumDetailPage from './Albums/AlbumDetailPage';
import AlbumProfilePage from './Albums/AlbumProfilePage';
import AlbumMemberPage from './Albums/AlbumMemberPage';
import AlbumsPage from './Albums/AlbumsPage';
import AlbumManagePage from './AlbumManage/AlbumManagePage';
import AlbumDetailAdminPage from './AlbumManage/AlbumDetailAdminPage';
import UserManagePage from './UserManage/UserManagePage';
import SpaceAnalyzePage from './SpaceAnalyze/SpaceAnalyzePage';
import HomePage from './HomePage';
import AssistantPage from './Assistant/AssistantPage';
import HitlUploadPage from './HitlUpload/HitlUploadPage';
import HitlUploadConfirmPage from './HitlUpload/HitlUploadConfirmPage';
import HitlUploadResultPage from './HitlUpload/HitlUploadResultPage';

interface DashboardProps {
  onChangeView: (view: ViewState) => void;
}

// Menu definitions
const MENU_ITEMS = [
  { id: 'gallery', label: '图片库', icon: <ImageIcon size={20} />, adminOnly: false },
  { id: 'assistant', label: 'AI助手', icon: <Bot size={20} />, adminOnly: false },
  { id: 'upload', label: '图片上传', icon: <UploadCloud size={20} />, adminOnly: false },
  { id: 'my-public', label: '我的发布', icon: <Share2 size={20} />, adminOnly: false },
  { id: 'albums', label: '我的相册', icon: <BookHeart size={20} />, adminOnly: false },
  { id: 'img-mgmt', label: '图片管理', icon: <Images size={20} />, adminOnly: true },
  { id: 'user-mgmt', label: '用户管理', icon: <Users size={20} />, adminOnly: true },
  { id: 'album-mgmt', label: '相册管理', icon: <FolderCog size={20} />, adminOnly: true },
  { id: 'analytics', label: '系统数据分析', icon: <BarChart3 size={20} />, adminOnly: true },
];

const Dashboard: React.FC<DashboardProps> = ({ onChangeView }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const isCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const userInfo = useAuthStore((s) => s.userInfo);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  let activeTab = 'gallery';
  let subTab: string | undefined;
  if (pathSegments[0] === 'dashboard') {
    activeTab = pathSegments[1] || 'gallery';
    subTab = pathSegments[2];
  } else if (pathSegments[0] === 'album') {
    activeTab = 'albums';
    subTab = pathSegments[1];
  } else if (pathSegments[0] === 'album-profile') {
    activeTab = 'album-profile';
    subTab = pathSegments[1];
  } else if (pathSegments[0] === 'album-members') {
    activeTab = 'album-members';
    subTab = pathSegments[1];
  }

  // Fetch current user on mount (MOCKED)
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentLoginUser();
      if (!user) {
        onChangeView(ViewState.LOGIN);
      }
      setLoading(false);
    };
    fetchUser();

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onChangeView]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    setSearchInput(searchParams.get('search') || '');
  }, [location.search]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchInput.trim()) {
        navigate(`/dashboard/gallery?search=${encodeURIComponent(searchInput.trim())}`);
      } else {
        navigate(`/dashboard/gallery`);
      }
    }
  };

  const handleLogout = async () => {
    await postLogout();
    onChangeView(ViewState.LOGIN);
    navigate('/', { replace: true });
  };

  const isAdmin = !!userInfo?.roles?.includes('admin');

  // Check if current page is allowed for current user
  useEffect(() => {
    if (loading) return;
    const currentItem = MENU_ITEMS.find(item => item.id === activeTab);
    if (currentItem?.adminOnly && !isAdmin) {
      navigate('/dashboard/gallery', { replace: true });
    }
  }, [activeTab, isAdmin, navigate, loading]);

  // Filter menu items based on role
  const visibleMenuItems = MENU_ITEMS.filter(item =>
    !item.adminOnly || isAdmin
  );

  const getPageName = (tabId: string) => {
    if (tabId === 'gallery') {
      return '图片库';
    }
    if (tabId === 'albums') {
      return '我的相册';
    }
    if (tabId === 'upload-confirm') {
      return '确认上传';
    }
    if (tabId === 'upload-result') {
      return '上传结果';
    }
    const item = MENU_ITEMS.find(m => m.id === tabId);
    return item ? item.label : '';
  };

  const pageName = getPageName(activeTab);
  const navTitle = pageName ? `昴云-${pageName}` : '昴云相册';

  const isTabAllowed = (tabId: string) => {
    const item = MENU_ITEMS.find(m => m.id === tabId);
    if (item?.adminOnly && !isAdmin) return false;
    return true;
  };

  useEffect(() => {
    document.title = navTitle;
  }, [navTitle]);

  const isAssistantTab = activeTab === 'assistant';

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-main)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const originalAvatarSrc =
    userInfo?.avatarUrl || 'https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/icon/subarupic.ico';
  const webpAvatarSrc = originalAvatarSrc.toLowerCase().endsWith('.ico') ? originalAvatarSrc : toWebpUrl(originalAvatarSrc);

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (originalAvatarSrc && e.currentTarget.src !== originalAvatarSrc) {
      e.currentTarget.src = originalAvatarSrc;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg-main)] text-[var(--text-primary)] overflow-hidden font-sans">
      {/* Sidebar - Pixiv style: Fixed Left */}
      <aside
        className={`
          flex-shrink-0 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] shadow-xl z-[60]
          transition-all duration-300 ease-in-out relative group
          ${isCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className={`
            absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full
            bg-[var(--bg-sidebar)]/80 backdrop-blur-md border border-[var(--border-color)] text-[var(--text-secondary)]
            shadow-lg transition-all duration-300 z-50
            opacity-40 group-hover:opacity-100 hover:!opacity-100
            hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-90
          `}
        >
          <ChevronLeft size={16} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>

        {/* Logo Area */}
        <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] transition-all duration-300`}>
          <img
            src="https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/icon/subarupic.ico"
            alt="昴云图标"
            title="昴云"
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 ml-3'}`}>
            <h1 className="text-xl font-bold tracking-wide text-[var(--text-primary)] whitespace-nowrap">
              昴云相册
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {visibleMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(`/dashboard/${item.id}`);
              }}
              title={isCollapsed ? item.label : undefined}
              className={`
                w-full flex items-center rounded-xl transition-all duration-200 ease-out group
                ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'}
                ${activeTab === item.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <span className={`
                ${activeTab === item.id ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}
                ${isCollapsed ? '' : 'mr-3'}
              `}>
                {item.icon}
              </span>
              <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Footer/Version (Optional) */}
        <div className={`p-4 text-xs text-gray-600 text-center border-t border-white/5 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          <div className="whitespace-nowrap">©️ 2026 昴云相册</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-main)]">

        {/* Top Header */}
        <header className="h-16 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 border-b border-[var(--border-color)] bg-[var(--bg-header)]/80 backdrop-blur-md sticky top-0 z-[100]">

          {/* Search Bar - Start */}
          <div className="relative w-56 md:w-80 lg:w-96 hidden sm:block group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors duration-200">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索图片 (按回车键搜索)"
              className="block w-full pl-10 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-full text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 focus:bg-[var(--bg-sidebar)] transition-all duration-200 shadow-sm"
            />
          </div>
          {/* Search Bar - End */}

          <div className="hidden flex-1 justify-center lg:flex">
            <button
              type="button"
              onClick={() => navigate('/dashboard/assistant')}
              className={`group relative inline-flex h-10 items-center gap-2 rounded-[16px] border px-5 transition-all duration-200 ${
                activeTab === 'assistant'
                  ? 'border-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_18px_38px_rgba(107,70,193,0.26)]'
                  : 'border-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_30px_rgba(107,70,193,0.18)]'
              } bg-[radial-gradient(circle_at_20%_20%,_rgba(214,188,250,0.28),_transparent_50%),radial-gradient(circle_at_80%_60%,_rgba(99,179,237,0.18),_transparent_56%),linear-gradient(90deg,_rgba(159,122,234,0.32),_rgba(99,179,237,0.22))] hover:-translate-y-[1px] hover:border-white/28 hover:bg-[radial-gradient(circle_at_25%_22%,_rgba(214,188,250,0.38),_transparent_48%),radial-gradient(circle_at_78%_58%,_rgba(99,179,237,0.26),_transparent_52%),linear-gradient(90deg,_rgba(159,122,234,0.42),_rgba(99,179,237,0.3))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_22px_44px_rgba(107,70,193,0.32)] active:translate-y-0 active:scale-[0.985] active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.18),0_14px_34px_rgba(107,70,193,0.22)]`}
              aria-label="打开 昴云 - 智能助手"
            >
              <span className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 blur-[18px] transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none bg-[radial-gradient(circle_at_30%_25%,_rgba(214,188,250,0.28),_transparent_58%),radial-gradient(circle_at_75%_60%,_rgba(99,179,237,0.22),_transparent_62%)]" />
              <span className="relative inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,_rgba(214,188,250,0.52),_rgba(159,122,234,0.3)_55%,_rgba(99,179,237,0.22)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_18px_rgba(107,70,193,0.18)]">
                <Bot size={16} className="text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.35)]" />
              </span>
              <span className="relative text-sm font-semibold leading-none text-white drop-shadow-[0_1px_10px_rgba(15,23,42,0.38)]">
                昴云 - 智能助手
              </span>
            </button>
          </div>

          {/* Right Side: User Profile & Theme Toggle */}
          <div className="flex items-center gap-4">

            <button
              type="button"
              onClick={() => navigate('/dashboard/assistant')}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors duration-200 lg:hidden ${
                activeTab === 'assistant'
                  ? 'border-transparent bg-gradient-to-r from-[#6B46C1] to-[#9F7AEA] text-white shadow-[0_12px_24px_rgba(107,70,193,0.28)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-white/10'
              }`}
              aria-label="打开 AI 智能助手"
            >
              <Bot size={18} />
            </button>

            {/* Message Center */}
            <MessageCenter />

            {/* User Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                data-toast-anchor="avatar"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 py-2 pl-4 pr-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors border border-transparent hover:border-[var(--border-color)]"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {userInfo?.username || 'User'}
                  </div>
                  <div className="text-xs text-primary/80 font-medium">
                    {isAdmin ? '管理员' : '普通用户'}
                  </div>
                </div>
                <div className="relative">
                  <img
                    src={webpAvatarSrc || originalAvatarSrc}
                    alt="Avatar"
                    className="w-9 h-9 rounded-full border border-white/20 object-cover"
                    onError={handleAvatarError}
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[var(--bg-header)]"></div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-sidebar)] rounded-xl shadow-2xl border border-[var(--border-color)] py-2 animate-in fade-in zoom-in-95 duration-200 z-50">
                  <button
                    onClick={() => navigate('/dashboard/profile')}
                    className="w-full flex items-center px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <UserIcon size={16} className="mr-2" />
                    个人中心
                  </button>
                  <div className="h-px bg-[var(--border-color)] my-1 mx-2"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <LogOut size={16} className="mr-2" />
                    退出登录
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle - Moved here */}
            <div className="pl-4 border-l border-[var(--border-color)]">
              <ThemeToggle />
            </div>

          </div>
        </header>

        <main
          className={`relative flex-1 min-h-0 scrollbar-hide ${
            isAssistantTab ? 'overflow-hidden p-3 sm:p-4 lg:p-5' : 'overflow-auto p-6'
          }`}
        >
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto h-full relative z-0">
            {!isTabAllowed(activeTab) ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                <p>正在跳转...</p>
              </div>
            ) : activeTab === 'gallery' ? (
              <HomePage />
            ) : activeTab === 'assistant' ? (
              <AssistantPage />
            ) : activeTab === 'img-mgmt' ? (
              <PictureManagePage />
            ) : activeTab === 'my-public' ? (
              <MyPublicPicturesPage />
            ) : activeTab === 'user-mgmt' ? (
              <UserManagePage />
            ) : activeTab === 'album-mgmt' ? (
              <AlbumManagePage />
            ) : activeTab === 'upload' ? (
              <HitlUploadPage />
            ) : activeTab === 'upload-confirm' ? (
              <HitlUploadConfirmPage />
            ) : activeTab === 'upload-result' ? (
              <HitlUploadResultPage />
            ) : activeTab === 'profile' ? (
              <ProfilePage />
            ) : activeTab === 'albums' ? (
              subTab ? (
                <AlbumDetailPage id={subTab} onBack={() => navigate('/dashboard/albums')} />
              ) : (
                <AlbumsPage />
              )
            ) : activeTab === 'album-profile' ? (
              subTab ? (
                <AlbumProfilePage
                  id={subTab}
                  onBack={() => navigate(`/album/${subTab}`)}
                  onDeleteSuccess={() => navigate('/dashboard/albums')}
                />
              ) : (
                <PendingDev title="Album Profile Missing ID" />
              )
            ) : activeTab === 'album-members' ? (
              subTab ? (
                <AlbumMemberPage
                  id={subTab}
                  onBack={() => navigate(`/album/${subTab}`)}
                />
              ) : (
                <PendingDev title="Album Members Missing ID" />
              )
            ) : activeTab === 'analytics' ? (
              <SpaceAnalyzePage />
            ) : (
              <PendingDev
                title={
                  MENU_ITEMS.find(m => m.id === activeTab)?.label || '未知页面'
                }
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
