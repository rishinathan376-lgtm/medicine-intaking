import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, AlertCircle, RefreshCw, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  highContrast?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  highContrast = false,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus on confirm or cancel button for accessibility
      setTimeout(() => confirmBtnRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const icon =
    variant === 'danger' ? (
      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
        <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
      </div>
    ) : variant === 'warning' ? (
      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
        <AlertCircle className="w-6 h-6 stroke-[2.5]" />
      </div>
    ) : (
      <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
        <Info className="w-6 h-6 stroke-[2.5]" />
      </div>
    );

  const confirmBtnColor =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30'
      : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div
        className={`w-full max-w-lg rounded-3xl border-2 shadow-2xl p-6 sm:p-7 space-y-5 transition transform scale-100 animate-slide-up ${
          highContrast ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {icon}
            <div>
              <h3 id="confirm-modal-title" className="text-xl font-black tracking-tight text-slate-900">
                {title}
              </h3>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Confirmation Required
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="confirm-modal-desc" className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {message}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 ${confirmBtnColor}`}
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
