/**
 * Keyboard shortcuts management hook
 * Provides a flexible system for registering and handling keyboard shortcuts
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /**
   * Unique identifier for this shortcut
   */
  id: string;

  /**
   * Key combination (e.g., 'Meta+z', 'Meta+Shift+z', 'Escape')
   * - Use 'Meta' for Cmd (Mac) or Ctrl (Windows/Linux)
   * - Use '+' to separate modifier keys
   * - Case-insensitive
   */
  keys: string;

  /**
   * Handler function to execute when shortcut is triggered
   */
  handler: (event: KeyboardEvent) => void;

  /**
   * Optional: Description for documentation
   */
  description?: string;

  /**
   * Optional: Only trigger if this condition is met
   */
  enabled?: boolean;

  /**
   * Optional: Prevent default browser behavior
   */
  preventDefault?: boolean;
}

/**
 * Parse key combination string into normalized format
 */
function parseKeys(keys: string): {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
} {
  const parts = keys.toLowerCase().split('+');

  return {
    meta: parts.includes('meta') || parts.includes('cmd'),
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts[parts.length - 1], // Last part is the actual key
  };
}

/**
 * Check if keyboard event matches a shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const parsed = parseKeys(shortcut.keys);

  // Check modifiers
  if (parsed.meta && !event.metaKey) return false;
  if (!parsed.meta && event.metaKey) return false;
  if (parsed.ctrl && !event.ctrlKey) return false;
  if (!parsed.ctrl && event.ctrlKey && !parsed.meta) return false; // Ctrl alone must be specified
  if (parsed.shift && !event.shiftKey) return false;
  if (!parsed.shift && event.shiftKey) return false;
  if (parsed.alt && !event.altKey) return false;
  if (!parsed.alt && event.altKey) return false;

  // Check key
  return event.key.toLowerCase() === parsed.key;
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Find matching shortcuts
    const matches = shortcutsRef.current.filter(shortcut => {
      // Skip if disabled
      if (shortcut.enabled === false) {
        return false;
      }

      return matchesShortcut(event, shortcut);
    });

    // Execute first matching shortcut
    if (matches.length > 0) {
      const shortcut = matches[0];

      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }

      shortcut.handler(event);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Pre-defined common shortcuts
 */
export const CommonShortcuts = {
  /**
   * Undo shortcut (Cmd+Z / Ctrl+Z)
   */
  undo: (handler: () => void, enabled: boolean = true): KeyboardShortcut => ({
    id: 'undo',
    keys: 'Meta+z',
    handler,
    description: 'Undo last action',
    enabled,
    preventDefault: true,
  }),

  /**
   * Redo shortcut (Cmd+Shift+Z / Ctrl+Shift+Z)
   */
  redo: (handler: () => void, enabled: boolean = true): KeyboardShortcut => ({
    id: 'redo',
    keys: 'Meta+Shift+z',
    handler,
    description: 'Redo last undone action',
    enabled,
    preventDefault: true,
  }),

  /**
   * Save shortcut (Cmd+S / Ctrl+S)
   */
  save: (handler: () => void, enabled: boolean = true): KeyboardShortcut => ({
    id: 'save',
    keys: 'Meta+s',
    handler,
    description: 'Save current work',
    enabled,
    preventDefault: true,
  }),

  /**
   * New shortcut (Cmd+N / Ctrl+N)
   */
  new: (handler: () => void, enabled: boolean = true): KeyboardShortcut => ({
    id: 'new',
    keys: 'Meta+n',
    handler,
    description: 'Create new item',
    enabled,
    preventDefault: true,
  }),

  /**
   * Find shortcut (Cmd+F / Ctrl+F)
   */
  find: (handler: () => void, enabled: boolean = true): KeyboardShortcut => ({
    id: 'find',
    keys: 'Meta+f',
    handler,
    description: 'Open search',
    enabled,
    preventDefault: true,
  }),

  /**
   * Escape shortcut
   */
  escape: (handler: () => void, enabled: boolean = true): KeyboardShortcut => ({
    id: 'escape',
    keys: 'Escape',
    handler,
    description: 'Cancel or close',
    enabled,
    preventDefault: false,
  }),
};
