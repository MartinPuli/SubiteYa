import React, { useEffect } from 'react';
import './Toast.css';

export interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type,
  duration = 5000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const icon = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  }[type];

  return (
    <div className={`toast toast--${type}`}>
      <span className="toast__icon">{icon}</span>
      <span className="toast__message">{message}</span>
      <button className="toast__close" onClick={() => onClose(id)}>
        ✕
      </button>
    </div>
  );
};
