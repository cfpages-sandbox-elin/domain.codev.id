import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  placement?: 'top' | 'bottom';
}

type ActiveTooltipState = {
  id: string;
  content: React.ReactNode;
  placement: 'top' | 'bottom';
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  transform: string;
  triggerEl: HTMLElement;
};

let activeTooltipState: ActiveTooltipState | null = null;
const activeListeners = new Set<() => void>();

const notifyActiveListeners = () => {
  activeListeners.forEach(listener => listener());
};

const computePosition = (
  triggerEl: HTMLElement,
  placement: 'top' | 'bottom',
  measuredHeight = 0,
) => {
  const rect = triggerEl.getBoundingClientRect();
  const margin = 16;
  const gap = 8;
  const width = Math.min(320, window.innerWidth - margin * 2);
  const halfWidth = width / 2;
  const centeredLeft = rect.left + rect.width / 2;
  const left = Math.min(Math.max(centeredLeft, margin + halfWidth), window.innerWidth - margin - halfWidth);
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

  return { left, top, width, maxHeight, transform };
};

const showSharedTooltip = (
  id: string,
  content: React.ReactNode,
  placement: 'top' | 'bottom',
  triggerEl: HTMLElement,
) => {
  if (typeof window === 'undefined') return;
  const position = computePosition(triggerEl, placement);
  activeTooltipState = {
    id,
    content,
    placement,
    triggerEl,
    ...position,
  };
  notifyActiveListeners();
};

const hideSharedTooltip = (id?: string) => {
  if (!activeTooltipState) return;
  if (id && activeTooltipState.id !== id) return;
  activeTooltipState = null;
  notifyActiveListeners();
};

/** Mount once near the app root. Owns the single tooltip portal. */
export const TooltipHost: React.FC = () => {
  const [active, setActive] = useState<ActiveTooltipState | null>(activeTooltipState);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sync = () => setActive(activeTooltipState ? { ...activeTooltipState } : null);
    activeListeners.add(sync);
    return () => {
      activeListeners.delete(sync);
    };
  }, []);

  useLayoutEffect(() => {
    if (!active || !tooltipRef.current) return;

    const measuredHeight = tooltipRef.current.scrollHeight;
    const next = computePosition(active.triggerEl, active.placement, measuredHeight);
    if (
      next.left !== active.left
      || next.top !== active.top
      || next.maxHeight !== active.maxHeight
      || next.transform !== active.transform
    ) {
      if (activeTooltipState?.id === active.id) {
        activeTooltipState = { ...activeTooltipState, ...next };
        setActive({ ...activeTooltipState });
      }
    }

    let frameId: number | null = null;
    const schedule = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (!activeTooltipState) return;
        const updated = computePosition(
          activeTooltipState.triggerEl,
          activeTooltipState.placement,
          tooltipRef.current?.scrollHeight || 0,
        );
        activeTooltipState = { ...activeTooltipState, ...updated };
        setActive({ ...activeTooltipState });
      });
    };

    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const hide = () => hideSharedTooltip();
    const hideOnVisibility = () => {
      if (document.hidden) hide();
    };
    const hideOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };

    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', hideOnVisibility);
    document.addEventListener('keydown', hideOnEscape);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', hideOnVisibility);
      document.removeEventListener('keydown', hideOnEscape);
    };
  }, [active]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <span
      ref={tooltipRef}
      className="pointer-events-none fixed z-[2147483647] rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-600 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      style={{
        left: active.left,
        top: active.top,
        width: active.width,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: active.maxHeight,
        overflowY: 'auto',
        transform: active.transform,
      }}
      role="tooltip"
    >
      {active.content}
    </span>,
    document.body,
  );
};

/**
 * Lightweight tooltip trigger. Does not mount a portal; TooltipHost renders the single shared portal.
 */
const Tooltip: React.FC<TooltipProps> = ({ children, content, className = '', placement = 'bottom' }) => {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef(content);
  const placementRef = useRef(placement);
  contentRef.current = content;
  placementRef.current = placement;

  useEffect(() => () => hideSharedTooltip(tooltipId), [tooltipId]);

  const showTooltip = useCallback(() => {
    if (!triggerRef.current) return;
    showSharedTooltip(tooltipId, contentRef.current, placementRef.current, triggerRef.current);
  }, [tooltipId]);

  const hideTooltip = useCallback(() => {
    hideSharedTooltip(tooltipId);
  }, [tooltipId]);

  const handleBlur = (event: React.FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      hideTooltip();
    }
  };

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
    </span>
  );
};

export default Tooltip;
