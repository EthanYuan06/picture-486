
import React, { useState } from 'react';
import { User, Mail, Lock } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import { ViewState } from '../types';
import { API_ROUTES } from '../config';
import { useToastStore } from '../stores/toastStore';

interface RegisterViewProps {
  onChangeView: (view: ViewState) => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onChangeView }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const addToast = useToastStore((state) => state.addToast);

  const [formData, setFormData] = useState({
    userAccount: '',
    userEmail: '',
    userPassword: '',
    checkPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (formData.userPassword !== formData.checkPassword) {
      setErrorMessage('两次输入的密码不一致');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setIsLoading(true);

    try {
      // 使用动态配置的 API 地址
      const response = await fetch(API_ROUTES.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.code === 0) {
        addToast('✅ 注册成功，正在跳转登录...', 'success');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          onChangeView(ViewState.LOGIN);
        }, 3000);
      } else {
        setErrorMessage(data.message || '注册失败，请稍后重试');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage('网络错误，请稍后重试');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Inline Error Message within form context */}

      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-white">创建账号</h2>
        <p className="text-white/80 text-sm mt-2">加入我们，开启全新旅程</p>
      </div>

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
          placeholder="请输入用户名" 
          icon={<User size={18} />} 
          required
        />
        <Input 
          type="email" 
          name="userEmail"
          value={formData.userEmail}
          onChange={handleInputChange}
          placeholder="请输入邮箱" 
          icon={<Mail size={18} />} 
          required
        />
        <Input 
          type="password" 
          name="userPassword"
          value={formData.userPassword}
          onChange={handleInputChange}
          placeholder="不少于8位，含大小写字母与数字" 
          icon={<Lock size={18} />} 
          required
        />
        <Input 
          type="password" 
          name="checkPassword"
          value={formData.checkPassword}
          onChange={handleInputChange}
          placeholder="请再次输入密码" 
          icon={<Lock size={18} />} 
          required
        />

        <div className="mt-6">
          <Button type="submit" isLoading={isLoading}>
            注册
          </Button>
        </div>
        
        <div className="mt-6 text-center">
          <button 
            type="button"
            className="text-sm text-white hover:text-white/80 transition-colors underline decoration-transparent hover:decoration-white underline-offset-4"
            onClick={() => onChangeView(ViewState.LOGIN)}
          >
            已有账号？立即登录
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterView;
