import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  type = 'danger'
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (!isOpen) return null;

  const colors = {
    danger: {
      icon: 'text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
    },
    warning: {
      icon: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
    },
    info: {
      icon: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
    }
  };

  const currentColor = colors[type];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 ${
        theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${currentColor.icon}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
          </div>
          <button 
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className={`mb-8 text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
              theme === 'dark' 
                ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' 
                : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-6 py-2 text-sm font-bold text-white rounded-md transition-all shadow-lg active:scale-95 ${currentColor.button}`}
          >
            {confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
