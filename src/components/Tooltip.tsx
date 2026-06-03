import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  placement?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, className = '', placement = 'bottom' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(320, window.innerWidth - margin * 2);
    const halfWidth = width / 2;
    const centeredLeft = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centeredLeft, margin + halfWidth), window.innerWidth - margin - halfWidth);
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

    setPosition({ left, top, width });
  }, [placement]);

  useLayoutEffect(() => {
    if (!isVisible) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, updatePosition]);

  const showTooltip = () => {
    setIsVisible(true);
    updatePosition();
  };

  const hideTooltip = () => setIsVisible(false);

  const handleBlur = (event: React.FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      hideTooltip();
    }
  };

  const tooltip = isVisible ? createPortal(
    <span
      className={`pointer-events-none fixed z-[2147483647] rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-600 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${placement === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2'}`}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        maxWidth: 'calc(100vw - 2rem)',
      }}
      role="tooltip"
    >
      {content}
    </span>,
    document.body,
  ) : null;

  return (
    <span
      ref={triggerRef}
      className={`inline-flex ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={handleBlur}
    >
      {children}
      {tooltip}
    </span>
  );
};

export default Tooltip;
