import React, { useState, useEffect, useRef } from 'react';
import { UserIcon, Mail, FileText, Calendar, PenLine, Camera, X, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { getCurrentLoginUser, updateUser, uploadUserAvatar } from '../services/user';
import { getCroppedImg } from '../utils/canvasUtils';
import { User as UserType } from '../types';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toastStore';
import { toWebpUrl } from '../utils/image';

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const authUser = useAuthStore((s) => s.userInfo);
  const addToast = useToastStore((s) => s.addToast);

  const [formData, setFormData] = useState({
    userName: '',
    userProfile: '',
  });

  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const userData = await getCurrentLoginUser();
    if (userData) {
      setUser(userData);
      setFormData({
        userName: userData.userName || '',
        userProfile: userData.userProfile || '',
      });
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      if (user) {
        setFormData({
          userName: user.userName || '',
          userProfile: user.userProfile || '',
        });
      }
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const success = await updateUser({
        id: user.id,
        userName: formData.userName,
        userProfile: formData.userProfile,
      });
      if (success) {
        await fetchUser();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update profile', error);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setAvatarSrc(reader.result as string);
        setIsCropModalOpen(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const closeCropModal = () => {
    setIsCropModalOpen(false);
    setAvatarSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadAvatar = async () => {
    if (!user || !avatarSrc || !croppedAreaPixels) return;
    try {
      setLoading(true);
      const croppedBlob = await getCroppedImg(avatarSrc, croppedAreaPixels);
      if (croppedBlob) {
        const file = new File([croppedBlob], "avatar.png", { type: "image/png" });
        await uploadUserAvatar(file);
        await fetchUser();
        closeCropModal();
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '头像上传失败';
      addToast(message, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="text-[var(--text-primary)] p-8">Loading...</div>;

  const originalAvatarSrc =
    authUser?.avatarUrl ||
    user.userAvatar ||
    'https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/icon/subarupic.ico';
  const webpAvatarSrc = originalAvatarSrc.toLowerCase().endsWith('.ico') ? originalAvatarSrc : toWebpUrl(originalAvatarSrc);

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (originalAvatarSrc && e.currentTarget.src !== originalAvatarSrc) {
      e.currentTarget.src = originalAvatarSrc;
    }
  };

  return (
    <div className="min-h-full pb-10">
      <div className="relative">
        <div className="h-48 w-full bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9] rounded-b-3xl shadow-lg" />

        <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
              <div className="relative group shrink-0">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden relative">
                  <img
                    src={webpAvatarSrc || originalAvatarSrc}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    onError={handleAvatarError}
                  />
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="text-white w-7 h-7" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              </div>

              <div className="flex-1 pb-2 md:pb-3 min-w-0 -mt-6 md:-mt-10">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center min-w-0">
                    {isEditing ? (
                      <input
                        name="userName"
                        value={formData.userName}
                        onChange={handleInputChange}
                        placeholder="请输入昵称"
                        className="w-[220px] sm:w-[280px] md:w-[360px] max-w-[70vw] text-[var(--profile-header-name)] text-xl md:text-2xl font-semibold bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-[var(--profile-header-name-placeholder)]"
                      />
                    ) : (
                      <h1 className="w-[220px] sm:w-[280px] md:w-[360px] max-w-[70vw] text-xl md:text-2xl font-semibold text-[var(--profile-header-name)] drop-shadow-[0_6px_16px_rgba(0,0,0,0.55)] truncate">
                        {user.userName || user.userAccount}
                      </h1>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)] shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <UserIcon size={18} className="text-[#8B5CF6]" />
              <div className="flex items-center gap-[10px]">
                <span className="text-sm text-[var(--text-secondary)] font-medium">登录账号</span>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/95 border border-white/15 backdrop-blur-sm shadow-primary/20 shrink-0">
                  <span className="text-sm font-semibold tracking-wide text-white">
                    {user.userRole === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </div>
              </div>
            </div>
            <div className="pl-8 text-lg text-[var(--text-primary)] font-semibold">
              {user.userAccount}
            </div>
          </div>

          <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)] shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Mail size={18} className="text-[#8B5CF6]" />
              <span className="text-sm text-[var(--text-secondary)] font-medium">电子邮箱</span>
            </div>
            <div className="pl-8 text-lg text-[var(--text-primary)] font-semibold">
              {user.userEmail || '未绑定'}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-color)] shadow-lg mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText size={18} className="text-[#8B5CF6]" />
            <span className="text-sm text-[var(--text-secondary)] font-medium">个人简介</span>
          </div>

          {isEditing ? (
            <div className="pl-8">
              <textarea
                name="userProfile"
                value={formData.userProfile}
                onChange={handleInputChange}
                rows={5}
                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6] transition-colors resize-none placeholder:text-[var(--text-secondary)]"
                placeholder="写点什么介绍自己..."
              />
            </div>
          ) : (
            <div className="pl-8 text-[var(--text-primary)]/90 leading-relaxed whitespace-pre-wrap">
              {user.userProfile || "这名用户很懒，还没有填写简介。"}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-4 sm:mb-0">
            <Calendar size={16} />
            <span>注册时间：{user.createTime ? new Date(user.createTime).toLocaleDateString() : '未知'}</span>
          </div>

          <div className="flex gap-4">
            {isEditing ? (
              <>
                <button
                  onClick={handleEditToggle}
                  className="px-6 py-2.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors font-medium flex items-center gap-2"
                  disabled={loading}
                >
                  <X size={18} />
                  取消
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="px-8 py-2.5 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-medium flex items-center gap-2"
                  disabled={loading}
                >
                  {loading ? '保存中...' : (
                    <>
                      <Check size={18} />
                      保存修改
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleEditToggle}
                className="px-8 py-3 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-medium flex items-center gap-2"
              >
                <PenLine size={18} />
                编辑个人信息
              </button>
            )}
          </div>
        </div>
      </div>

      {isCropModalOpen && avatarSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[var(--bg-card)] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)]">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="text-[var(--text-primary)] font-semibold">调整头像</h3>
              <button type="button" onClick={closeCropModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>

            <div className="relative h-80 w-full bg-black">
              <Cropper
                image={avatarSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-xs text-[var(--text-secondary)]">缩放</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[#8B5CF6]"
                />
              </div>

              <div className="relative flex justify-end gap-3">
                <div className="absolute left-0 bottom-0 text-xs text-[var(--text-secondary)]">
                  请上传小于1MB的头像文件
                </div>
                <button
                  type="button"
                  onClick={closeCropModal}
                  className="px-5 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleUploadAvatar}
                  disabled={loading}
                  className="px-6 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {loading ? '处理中...' : '确认上传'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
