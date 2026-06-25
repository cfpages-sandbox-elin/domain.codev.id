

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-60 backdrop-blur-sm sm:items-center"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative m-0 flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-xl bg-white shadow-xl dark:bg-slate-800 sm:m-4 sm:max-h-[88vh] sm:rounded-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b p-3 dark:border-slate-600 sm:p-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white sm:text-xl" id="modal-title">
            {title}
          </h3>
          <button
            type="button"
            className="text-slate-400 bg-transparent hover:bg-slate-200 hover:text-slate-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-slate-600 dark:hover:text-white"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
