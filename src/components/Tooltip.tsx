import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  placement?: 'top' | 'bottom';
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
}

type ActiveTooltipState = {
  id: string;
  content: React.ReactNode;
  placement: 'top' | 'bottom';
  size: 'sm' | 'md' | 'lg';
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  transform: string;
  triggerEl: HTMLElement;
};

let activeTooltipState: ActiveTooltipState | null = null;
const activeListeners = new Set<() => void>();

let isWindowScrolling = false;
let scrollEndTimer: number | null = null;
let hideGraceTimer: number | null = null;
let lastClosedTimestamp = 0;

export const cancelTooltipHide = () => {
  if (hideGraceTimer !== null) {
    window.clearTimeout(hideGraceTimer);
    hideGraceTimer = null;
  }
};

export const scheduleTooltipHide = (delay = 120) => {
  cancelTooltipHide();
  hideGraceTimer = window.setTimeout(() => {
    hideGraceTimer = null;
    lastClosedTimestamp = Date.now();
    activeTooltipState = null;
    notifyActiveListeners();
  }, delay);
};

if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => {
      isWindowScrolling = true;
      cancelTooltipHide();
      if (activeTooltipState) {
        activeTooltipState = null;
        lastClosedTimestamp = Date.now();
        notifyActiveListeners();
      }
      if (scrollEndTimer !== null) {
        window.clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = window.setTimeout(() => {
        isWindowScrolling = false;
        scrollEndTimer = null;
      }, 150);
    },
    { passive: true, capture: true },
  );
}

const notifyActiveListeners = () => {
  activeListeners.forEach(listener => listener());
};

const computePosition = (
  triggerEl: HTMLElement,
  placement: 'top' | 'bottom',
  size: 'sm' | 'md' | 'lg' = 'md',
  measuredHeight = 0,
) => {
  const rect = triggerEl.getBoundingClientRect();
  const margin = 12;
  const gap = 8;
  const targetWidth = size === 'lg' ? 480 : size === 'sm' ? 220 : 320;
  const width = Math.min(targetWidth, window.innerWidth - margin * 2);
  const halfWidth = width / 2;
  const centeredLeft = rect.left + rect.width / 2;
  const left = Math.min(Math.max(centeredLeft, margin + halfWidth), window.innerWidth - margin - halfWidth);
  const spaceBelow = Math.max(window.innerHeight - rect.bottom - margin - gap, 0);
  const spaceAbove = Math.max(rect.top - margin - gap, 0);
  const shouldPlaceTop = placement === 'top'
    ? spaceAbove >= Math.min(measuredHeight || 120, 120) || spaceAbove >= spaceBelow
    : measuredHeight > 0 && spaceBelow < Math.min(measuredHeight, 120) && spaceAbove > spaceBelow;
  const maxHeight = Math.min(Math.max(shouldPlaceTop ? spaceAbove : spaceBelow, 48), 380);
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
  size: 'sm' | 'md' | 'lg',
  triggerEl: HTMLElement,
) => {
  if (typeof window === 'undefined' || isWindowScrolling) return;
  cancelTooltipHide();
  const position = computePosition(triggerEl, placement, size);
  activeTooltipState = {
    id,
    content,
    placement,
    size,
    triggerEl,
    ...position,
  };
  notifyActiveListeners();
};

const hideSharedTooltip = (id?: string) => {
  if (!activeTooltipState) return;
  if (id && activeTooltipState.id !== id) return;
  cancelTooltipHide();
  lastClosedTimestamp = Date.now();
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
    const next = computePosition(active.triggerEl, active.placement, active.size, measuredHeight);
    if (
      next.left !== active.left
      || next.top !== active.top
      || next.maxHeight !== active.maxHeight
      || next.transform !== active.transform
      || next.width !== active.width
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
          activeTooltipState.size,
          tooltipRef.current?.scrollHeight || 0,
        );
        activeTooltipState = { ...activeTooltipState, ...updated };
        setActive({ ...activeTooltipState });
      });
    };

    window.addEventListener('resize', schedule);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedule);
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
      onMouseEnter={cancelTooltipHide}
      onMouseLeave={() => scheduleTooltipHide(120)}
      className="pointer-events-auto fixed z-[2147483647] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      style={{
        left: active.left,
        top: active.top,
        width: active.width,
        maxWidth: 'calc(100vw - 1.5rem)',
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
const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  className = '',
  placement = 'bottom',
  size = 'md',
  delay,
}) => {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef(content);
  const placementRef = useRef(placement);
  const sizeRef = useRef(size);
  const showTimerRef = useRef<number | null>(null);
  contentRef.current = content;
  placementRef.current = placement;
  sizeRef.current = size;

  const cancelShowTimer = () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    cancelShowTimer();
    hideSharedTooltip(tooltipId);
  }, [tooltipId]);

  const showTooltip = useCallback(() => {
    cancelShowTimer();
    cancelTooltipHide();
    if (isWindowScrolling || !triggerRef.current) return;

    // Warm delay: if a tooltip was active within 350ms, display immediately (0ms).
    // Otherwise use 50ms default (or explicitly passed delay).
    const effectiveDelay = delay !== undefined
      ? delay
      : (Date.now() - lastClosedTimestamp < 350 ? 0 : 50);

    if (effectiveDelay === 0) {
      showSharedTooltip(tooltipId, contentRef.current, placementRef.current, sizeRef.current, triggerRef.current);
    } else {
      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (isWindowScrolling || !triggerRef.current) return;
        showSharedTooltip(tooltipId, contentRef.current, placementRef.current, sizeRef.current, triggerRef.current);
      }, effectiveDelay);
    }
  }, [delay, tooltipId]);

  const hideTooltip = useCallback(() => {
    cancelShowTimer();
    scheduleTooltipHide(120);
  }, []);

  const handleBlur = (event: React.FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      cancelShowTimer();
      hideSharedTooltip(tooltipId);
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
