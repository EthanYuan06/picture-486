import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, ToastType } from '../../stores/toastStore';

interface ToastItemProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const icons = {
  success: <CheckCircle className="text-green-500" size={20} />,
  error: <AlertCircle className="text-red-500" size={20} />,
  warning: <AlertTriangle className="text-yellow-500" size={20} />,
  info: <Info className="text-blue-500" size={20} />,
};

const ToastItem: React.FC<ToastItemProps> = ({ id, message, type, duration = 3000 }) => {
  const removeToast = useToastStore((state) => state.removeToast);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 弹出动画 300ms (handled by CSS transition duration-300)
    // 停留 duration ms (default 3000)
    // 收回动画 300ms (handled by CSS transition duration-300)

    // Trigger fade in
    const raf = requestAnimationFrame(() => setIsVisible(true));
    
    // Auto dismiss after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [duration]);

  const handleTransitionEnd = () => {
    if (!isVisible) {
      removeToast(id);
    }
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur-md
        min-w-[260px] max-w-[420px]
        transition-all duration-300 transform
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      onTransitionEnd={handleTransitionEnd}
      role="alert"
    >
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <p className="flex-1 text-sm font-medium text-[var(--text-primary)] whitespace-normal break-words leading-snug text-left">
        {message}
      </p>
      <button
        onClick={() => setIsVisible(false)}
        className="p-1 hover:bg-[var(--bg-hover)] rounded-full text-[var(--text-secondary)] transition-colors ml-2 flex-shrink-0"
        aria-label="关闭"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ToastItem;
