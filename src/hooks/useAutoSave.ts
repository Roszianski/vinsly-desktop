import { useState, useCallback, useEffect, useRef } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveOptions<T> {
  /** Unique key for storing the draft (e.g., 'agent-editor-draft-{id}') */
  storageKey: string;
  /** Data to auto-save */
  data: T;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Debounce delay in milliseconds (default: 3000) */
  debounceMs?: number;
  /** Callback when data is restored from storage */
  onRestore?: (data: T) => void;
  /** Duration to show "Saved" status in ms (default: 2000) */
  savedIndicatorDuration?: number;
}

export interface UseAutoSaveReturn<T> {
  /** Current auto-save status */
  status: AutoSaveStatus;
  /** Last saved timestamp */
  lastSavedAt: Date | null;
  /** Whether there's a draft available to restore */
  hasDraft: boolean;
  /** Restore the saved draft */
  restoreDraft: () => T | null;
  /** Clear the saved draft */
  clearDraft: () => void;
  /** Manually trigger a save */
  saveNow: () => void;
  /** Check if draft exists (useful before mounting) */
  checkDraft: () => boolean;
}

/**
 * Hook for auto-saving form data to localStorage with debouncing
 *
 * @example
 * ```tsx
 * const { status, hasDraft, restoreDraft, clearDraft } = useAutoSave({
 *   storageKey: `agent-draft-${agentId}`,
 *   data: formData,
 *   debounceMs: 5000,
 *   onRestore: (data) => setFormData(data),
 * });
 *
 * // Show "Saving..." indicator
 * {status === 'saving' && <span>Saving...</span>}
 *
 * // Show restore prompt
 * {hasDraft && (
 *   <button onClick={restoreDraft}>Restore draft</button>
 * )}
 * ```
 */
export function useAutoSave<T>(options: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const {
    storageKey,
    data,
    enabled = true,
    debounceMs = 3000,
    onRestore,
    savedIndicatorDuration = 2000,
  } = options;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const dataRef = useRef(data);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Keep data ref up to date
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setHasDraft(stored !== null);
    } catch {
      setHasDraft(false);
    }
  }, [storageKey]);

  // Debounced auto-save
  useEffect(() => {
    // Skip first render (initial data shouldn't trigger save)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save
    timeoutRef.current = setTimeout(() => {
      try {
        setStatus('saving');
        localStorage.setItem(storageKey, JSON.stringify(dataRef.current));
        setLastSavedAt(new Date());
        setHasDraft(true);
        setStatus('saved');

        // Reset to idle after showing "Saved"
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => {
          setStatus('idle');
        }, savedIndicatorDuration);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, storageKey, debounceMs, savedIndicatorDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const restoreDraft = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        onRestore?.(parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Failed to restore draft:', error);
    }
    return null;
  }, [storageKey, onRestore]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setStatus('idle');
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [storageKey]);

  const saveNow = useCallback(() => {
    // Clear pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      setStatus('saving');
      localStorage.setItem(storageKey, JSON.stringify(dataRef.current));
      setLastSavedAt(new Date());
      setHasDraft(true);
      setStatus('saved');

      // Reset to idle after showing "Saved"
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => {
        setStatus('idle');
      }, savedIndicatorDuration);
    } catch (error) {
      console.error('Save failed:', error);
      setStatus('error');
    }
  }, [storageKey, savedIndicatorDuration]);

  const checkDraft = useCallback((): boolean => {
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }, [storageKey]);

  return {
    status,
    lastSavedAt,
    hasDraft,
    restoreDraft,
    clearDraft,
    saveNow,
    checkDraft,
  };
}

/**
 * Get display text and styling for auto-save status
 */
export function getAutoSaveStatusDisplay(status: AutoSaveStatus): { text: string; className: string } | null {
  if (status === 'idle') return null;

  const statusConfig = {
    saving: {
      text: 'Saving...',
      className: 'text-v-light-text-secondary dark:text-v-text-secondary',
    },
    saved: {
      text: 'Saved',
      className: 'text-v-success',
    },
    error: {
      text: 'Save failed',
      className: 'text-v-danger',
    },
  };

  return statusConfig[status as keyof typeof statusConfig] || null;
}

