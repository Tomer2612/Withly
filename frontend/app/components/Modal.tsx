'use client';

import { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Blur backdrop instead of solid color */
  blur?: boolean;
  /** Allow closing by clicking backdrop */
  closeOnBackdrop?: boolean;
  /** z-index class */
  zIndex?: string;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  blur = true,
  closeOnBackdrop = true,
  zIndex = 'z-50',
}: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Intentionally NOT locking page scroll. Native scrollbars are browser
  // chrome painted above DOM content, so the modal backdrop can't darken
  // them — locking scroll would make the scrollbar disappear and either
  // cause layout shift or require a fragile gutter workaround. Allowing
  // the page to scroll behind the modal is the cleaner trade-off.

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center ${
        blur ? 'backdrop-blur-sm bg-black/30' : 'bg-black/50'
      }`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
