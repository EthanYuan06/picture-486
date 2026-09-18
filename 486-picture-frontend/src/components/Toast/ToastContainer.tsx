import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '../../stores/toastStore';
import ToastItem from './ToastItem';

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  if (typeof document === 'undefined') return null;

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      const el = document.querySelector('[data-toast-anchor="avatar"]') as HTMLElement | null;
      if (!el) {
        setAnchorRect(null);
        return;
      }
      setAnchorRect(el.getBoundingClientRect());
    };
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };
    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [toasts.length]);

  const avatarStyle: React.CSSProperties | null =
    anchorRect && anchorRect.width > 0 && anchorRect.height > 0
      ? {
        position: 'fixed',
        top: anchorRect.bottom + 10,
        left: anchorRect.right,
        transform: 'translateX(-100%)',
      }
      : null;

  // Render to body
  return createPortal(
    <>
      {avatarStyle ? (
        <div style={avatarStyle} className="z-[200] pointer-events-none">
          <div className="flex flex-col gap-3 items-end">
            {toasts
              .filter((t) => (t.placement ?? 'avatar') === 'avatar')
              .map((toast) => (
                <ToastItem key={toast.id} {...toast} />
              ))}
          </div>
        </div>
      ) : (
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} {...toast} />
          ))}
        </div>
      )}
    </>,
    document.body
  );
};

export default ToastContainer;
