import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseFormDirtyOptions {
  /** Initial dirty state (default: false) */
  initialDirty?: boolean;
  /** Callback when user tries to navigate away with unsaved changes */
  onNavigateAway?: () => boolean | void;
  /** Enable browser beforeunload warning (default: true) */
  enableBeforeUnload?: boolean;
}

export interface UseFormDirtyReturn {
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Mark the form as having unsaved changes */
  markDirty: () => void;
  /** Mark the form as clean (no unsaved changes) */
  markClean: () => void;
  /** Reset dirty state to initial value */
  reset: () => void;
  /** Track a value for changes - returns wrapped onChange that auto-marks dirty */
  trackChange: <T>(onChange: (value: T) => void) => (value: T) => void;
  /** Check if navigation should proceed - returns true if safe to navigate */
  confirmNavigation: () => boolean;
}

/**
 * Hook to track form dirty state and prevent accidental data loss
 *
 * @example
 * ```tsx
 * const { isDirty, trackChange, confirmNavigation } = useFormDirty();
 *
 * const handleNameChange = trackChange((value: string) => {
 *   setName(value);
 * });
 *
 * const handleCancel = () => {
 *   if (confirmNavigation()) {
 *     navigateAway();
 *   }
 * };
 * ```
 */
export function useFormDirty(options: UseFormDirtyOptions = {}): UseFormDirtyReturn {
  const {
    initialDirty = false,
    onNavigateAway,
    enableBeforeUnload = true,
  } = options;

  const [isDirty, setIsDirty] = useState(initialDirty);
  const isDirtyRef = useRef(isDirty);

  // Keep ref in sync with state for beforeunload handler
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Browser beforeunload warning
  useEffect(() => {
    if (!enableBeforeUnload) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        // Modern browsers ignore custom messages and show their own
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enableBeforeUnload]);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const reset = useCallback(() => {
    setIsDirty(initialDirty);
  }, [initialDirty]);

  const trackChange = useCallback(<T,>(onChange: (value: T) => void) => {
    return (value: T) => {
      setIsDirty(true);
      onChange(value);
    };
  }, []);

  const confirmNavigation = useCallback((): boolean => {
    if (!isDirtyRef.current) {
      return true;
    }

    // If custom handler provided, use it
    if (onNavigateAway) {
      const result = onNavigateAway();
      return result === true;
    }

    // Default: show browser confirm dialog
    return window.confirm('You have unsaved changes. Are you sure you want to leave?');
  }, [onNavigateAway]);

  return {
    isDirty,
    markDirty,
    markClean,
    reset,
    trackChange,
    confirmNavigation,
  };
}
