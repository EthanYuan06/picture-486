import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastPlacement = 'avatar' | 'top-right';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  placement?: ToastPlacement;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number, placement?: ToastPlacement) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3000, placement = 'avatar') => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration, placement }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
