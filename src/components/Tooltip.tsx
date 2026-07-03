import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  placement?: 'top' | 'bottom';
}

let nextTooltipId = 0;
let activeTooltip: { id: string; hide: () => void } | null = null;

const Tooltip: React.FC<TooltipProps> = ({ children, content, className = '', placement = 'bottom' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, maxHeight: 320, transform: 'translateX(-50%)' });
  const tooltipIdRef = useRef(`tooltip-${++nextTooltipId}`);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 16;
    const gap = 8;
    const width = Math.min(320, window.innerWidth - margin * 2);
    const halfWidth = width / 2;
    const centeredLeft = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centeredLeft, margin + halfWidth), window.innerWidth - margin - halfWidth);
    const measuredHeight = tooltipRef.current?.scrollHeight || 0;
    const spaceBelow = Math.max(window.innerHeight - rect.bottom - margin - gap, 0);
    const spaceAbove = Math.max(rect.top - margin - gap, 0);
    const shouldPlaceTop = placement === 'top'
      ? spaceAbove >= Math.min(measuredHeight || 120, 120) || spaceAbove >= spaceBelow
      : measuredHeight > 0 && spaceBelow < Math.min(measuredHeight, 120) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(shouldPlaceTop ? spaceAbove : spaceBelow, 48);
    const renderedHeight = measuredHeight > 0 ? Math.min(measuredHeight, maxHeight) : 0;
    const top = shouldPlaceTop ? rect.top - gap - renderedHeight : rect.bottom + gap;
    const transform = measuredHeight > 0
      ? 'translateX(-50%)'
      : shouldPlaceTop
        ? 'translateX(-50%) translateY(-100%)'
        : 'translateX(-50%)';

    setPosition({ left, top, width, maxHeight, transform });
  }, [placement]);

  useLayoutEffect(() => {
    if (!isVisible) return;

    updatePosition();
    let frameId: number | null = null;
    const schedulePositionUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [isVisible, updatePosition]);

  const hideTooltip = useCallback(() => {
    setIsVisible(false);
    if (activeTooltip?.id === tooltipIdRef.current) {
      activeTooltip = null;
    }
  }, []);

  const showTooltip = useCallback(() => {
    if (activeTooltip?.id !== tooltipIdRef.current) {
      activeTooltip?.hide();
      activeTooltip = { id: tooltipIdRef.current, hide: hideTooltip };
    }
    updatePosition();
    setIsVisible(true);
  }, [hideTooltip, updatePosition]);

  useEffect(() => {
    const tooltipId = tooltipIdRef.current;
    return () => {
      if (activeTooltip?.id === tooltipId) {
        activeTooltip = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const hideOnInactivePage = () => hideTooltip();
    const hideOnVisibilityChange = () => {
      if (document.hidden) hideTooltip();
    };
    const hideOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideTooltip();
    };

    window.addEventListener('blur', hideOnInactivePage);
    window.addEventListener('pagehide', hideOnInactivePage);
    document.addEventListener('visibilitychange', hideOnVisibilityChange);
    document.addEventListener('keydown', hideOnEscape);

    return () => {
      window.removeEventListener('blur', hideOnInactivePage);
      window.removeEventListener('pagehide', hideOnInactivePage);
      document.removeEventListener('visibilitychange', hideOnVisibilityChange);
      document.removeEventListener('keydown', hideOnEscape);
    };
  }, [hideTooltip, isVisible]);

  const handleBlur = (event: React.FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      hideTooltip();
    }
  };

  const tooltip = isVisible ? createPortal(
    <span
      ref={tooltipRef}
      className="pointer-events-none fixed z-[2147483647] rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-600 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: position.maxHeight,
        overflowY: 'auto',
        transform: position.transform,
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
