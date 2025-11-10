import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>(set => ({
  toasts: [],
  addToast: toast =>
    set(state => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: `toast-${Date.now()}-${Math.random()}`,
        },
      ],
    })),
  removeToast: id =>
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    })),
}));

// Helper functions for easy use
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'error', duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'info', duration }),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'warning', duration }),
};
