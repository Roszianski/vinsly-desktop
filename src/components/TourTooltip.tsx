import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { tourTooltipVariants } from '../animations';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TourTooltipProps {
  targetSelector: string; // CSS selector for the element to highlight
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  position?: TooltipPosition;
  onNext: () => void;
  onSkip: () => void;
}

export const TourTooltip: React.FC<TourTooltipProps> = ({
  targetSelector,
  title,
  description,
  currentStep,
  totalSteps,
  position = 'bottom',
  onNext,
  onSkip
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [arrowOffset, setArrowOffset] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targetElement = document.querySelector(targetSelector) as HTMLElement | null;
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    const updatePosition = () => {
      const targetEl = document.querySelector(targetSelector);
      if (!targetEl || !tooltipRef.current) return;

      // Make target element appear above backdrop
      (targetEl as HTMLElement).style.position = 'relative';
      (targetEl as HTMLElement).style.zIndex = '10002';

      // Get computed background color
      const computedStyle = window.getComputedStyle(targetEl);
      const computedBg = computedStyle.backgroundColor;

      // If background is transparent, we need to ensure visibility
      if (computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent') {
        // Check if we're in light or dark mode
        const isDarkMode = document.documentElement.classList.contains('dark');
        // Use solid colors that will be visible - light gray for light mode, dark gray for dark mode
        const bgColor = isDarkMode ? '#1a1a1a' : '#f5f5f5';
        (targetEl as HTMLElement).style.backgroundColor = bgColor;
        (targetEl as HTMLElement).dataset.tourBgAdded = 'true';
      }

      (targetEl as HTMLElement).style.isolation = 'isolate';

      const rect = targetEl.getBoundingClientRect();
      setTargetRect(rect);
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const offset = 16; // Distance from target element

      let top = 0;
      let left = 0;

      switch (position) {
        case 'bottom':
          top = rect.bottom + offset + window.scrollY;
          left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX;
          setArrowOffset(tooltipRect.width / 2);
          break;
        case 'top':
          top = rect.top - tooltipRect.height - offset + window.scrollY;
          left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX;
          setArrowOffset(tooltipRect.width / 2);
          break;
        case 'left':
          top = rect.top + (rect.height / 2) - (tooltipRect.height / 2) + window.scrollY;
          left = rect.left - tooltipRect.width - offset + window.scrollX;
          setArrowOffset(tooltipRect.height / 2);
          break;
        case 'right':
          top = rect.top + (rect.height / 2) - (tooltipRect.height / 2) + window.scrollY;
          left = rect.right + offset + window.scrollX;
          setArrowOffset(tooltipRect.height / 2);
          break;
      }

      // Keep tooltip within viewport (accounting for scroll position)
      const maxLeft = window.innerWidth - tooltipRect.width - 16;
      const maxTop = window.innerHeight + window.scrollY - tooltipRect.height - 16;
      const minTop = window.scrollY + 16;
      left = Math.max(16, Math.min(left, maxLeft));
      top = Math.max(minTop, Math.min(top, maxTop));

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      // Reset target element styles
      const resetTarget = document.querySelector(targetSelector);
      if (resetTarget) {
        (resetTarget as HTMLElement).style.position = '';
        (resetTarget as HTMLElement).style.zIndex = '';
        (resetTarget as HTMLElement).style.isolation = '';
        if ((resetTarget as HTMLElement).dataset.tourBgAdded) {
          (resetTarget as HTMLElement).style.backgroundColor = '';
          delete (resetTarget as HTMLElement).dataset.tourBgAdded;
        }
      }
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [targetSelector, position]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onSkip]);

  const getArrowStyles = (): React.CSSProperties => {
    const arrowSize = 8;
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    };

    switch (position) {
      case 'bottom':
        return {
          ...base,
          top: -arrowSize,
          left: arrowOffset - arrowSize,
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: 'transparent transparent var(--tooltip-bg) transparent',
        };
      case 'top':
        return {
          ...base,
          bottom: -arrowSize,
          left: arrowOffset - arrowSize,
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: 'var(--tooltip-bg) transparent transparent transparent',
        };
      case 'left':
        return {
          ...base,
          right: -arrowSize,
          top: arrowOffset - arrowSize,
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderColor: 'transparent transparent transparent var(--tooltip-bg)',
        };
      case 'right':
        return {
          ...base,
          left: -arrowSize,
          top: arrowOffset - arrowSize,
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderColor: 'transparent var(--tooltip-bg) transparent transparent',
        };
      default:
        return base;
    }
  };

  return (
    <>
      {/* Spotlight highlight on target element */}
      {targetRect && (
        <>
          {/* White overlay to brighten the area - stronger in light mode */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              zIndex: 10001,
              pointerEvents: 'none',
            }}
            className="rounded-lg bg-white/30 dark:bg-white/10"
          />
          {/* Border */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              zIndex: 10003,
              pointerEvents: 'none',
            }}
            className="rounded-lg border-4 border-v-accent"
          />
        </>
      )}

      <motion.div
        ref={tooltipRef}
        variants={tourTooltipVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          position: 'absolute',
          top: coords.top,
          left: coords.left,
          zIndex: 10004,
          maxWidth: '360px',
        } as React.CSSProperties}
        className="bg-v-accent dark:bg-v-accent text-white rounded-lg shadow-2xl p-5"
      >
      <div style={getArrowStyles()} />

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-base mb-1">{title}</h3>
            <p className="text-sm text-white/90 leading-relaxed">{description}</p>
          </div>
          <button
            onClick={onSkip}
            className="text-white/70 hover:text-white text-2xl leading-none transition-colors -mt-1"
            aria-label="Close tour"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/20">
          <span className="text-xs text-white/70 font-medium">
            Step {currentStep} of {totalSteps}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="px-3 py-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              Skip Tour
            </button>
            <button
              onClick={onNext}
              className="px-4 py-1.5 text-sm font-semibold bg-white text-v-accent rounded-md hover:bg-white/90 transition-colors"
            >
              {currentStep === totalSteps ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
      </motion.div>
    </>
  );
};
