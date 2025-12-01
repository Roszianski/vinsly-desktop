import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType, ToastAction } from '../components/Toast';

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number, action?: ToastAction) => void;
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration?: number, action?: ToastAction) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, type, message, duration, action };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
