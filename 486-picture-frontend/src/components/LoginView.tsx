
import React, { useState } from 'react';
import { User, Lock } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import Switch from './Switch';
import { ViewState } from '../types';
import { postLogin } from '../services/user';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toastStore';

interface LoginViewProps {
  onChangeView: (view: ViewState) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onChangeView }) => {
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const addToast = useToastStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    userAccount: '',
    userPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
        const user = await postLogin(formData);
      if (user) {
        addToast('✅ 登录成功，正在跳转...', 'success');
        
        // 延迟跳转，显示成功提示
        setTimeout(() => {
          onChangeView(ViewState.DASHBOARD);
        }, 800);
      } else {
            setErrorMessage('账号或密码错误');
        }
    } catch (error) {
        console.error('Login error:', error);
        setErrorMessage('网络连接失败，请检查网络或联系管理员');
    } finally {
        setIsLoading(false);
    }
  };

  const handleContactClick = () => {
    addToast('📧 QQ邮箱：2329697573@qq.com', 'info');
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Inline Error Message within form context */}

      {/* Header */}
      <div className="mb-10 flex flex-col items-center justify-center text-center">
        <img 
          src="https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/icon/subarupic.ico" 
          alt="Logo" 
          className="w-20 h-20 mb-4 drop-shadow-lg"
        />
        <h1 className="text-3xl font-bold tracking-widest text-white drop-shadow-md">
          昴云相册
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full bg-white/20 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-2xl transition-all duration-300">
        {errorMessage && (
          <div className="mb-4 px-4 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 text-sm transition-all duration-300">
            {errorMessage}
          </div>
        )}
        <Input 
          type="text" 
          name="userAccount"
          value={formData.userAccount}
          onChange={handleInputChange}
          placeholder="用户名" 
          icon={<User size={18} />} 
          required
        />
        <Input 
          type="password" 
          name="userPassword"
          value={formData.userPassword}
          onChange={handleInputChange}
          placeholder="密码" 
          icon={<Lock size={18} />} 
          required
        />

        <div className="mt-6">
          <Button type="submit" isLoading={isLoading}>
            登录
          </Button>
        </div>

        {/* Options */}
        <div className="flex items-center justify-between mt-6">
          <Switch 
            checked={rememberMe} 
            onChange={setRememberMe} 
            label="记住密码" 
          />
          <button 
            type="button"
            className="text-sm text-white hover:text-white/80 transition-colors"
            onClick={() => onChangeView(ViewState.RESET_PASSWORD)}
          >
            忘记密码
          </button>
        </div>
      </form>

      {/* Footer */}
      <div className="mt-8 flex w-full justify-between items-center px-2">
         <button 
            type="button"
            className="text-sm text-white hover:text-white/80 transition-colors"
            onClick={() => onChangeView(ViewState.REGISTER)}
          >
            注册
          </button>
          
          <button 
            type="button"
            className="text-sm text-white hover:text-white/80 transition-colors"
            onClick={handleContactClick}
          >
            联系作者
          </button>
      </div>
    </div>
  );
};

export default LoginView;
