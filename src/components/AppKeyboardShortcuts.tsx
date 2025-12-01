/**
 * AppKeyboardShortcuts
 * Manages all global keyboard shortcuts for the application
 * Extracts keyboard shortcut logic from App.tsx for better organization
 */

import { useKeyboardShortcuts, CommonShortcuts, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface AppKeyboardShortcutsProps {
  // Navigation
  onCreateAgent: () => void;
  isMacLike: boolean;

  // Undo/Redo
  onUndo: () => Promise<string | null>;
  onRedo: () => Promise<string | null>;
  canUndo: boolean;
  canRedo: boolean;
  onShowUndoToast: (message: string) => void;
}

/**
 * Component that sets up all global keyboard shortcuts
 * This component renders nothing but handles keyboard events
 */
export function AppKeyboardShortcuts({
  onCreateAgent,
  isMacLike,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onShowUndoToast,
}: AppKeyboardShortcutsProps) {
  const shortcuts: KeyboardShortcut[] = [
    // Create new agent (Cmd+N / Ctrl+N)
    CommonShortcuts.new(onCreateAgent, true),

    // Undo (Cmd+Z / Ctrl+Z)
    CommonShortcuts.undo(
      () => {
        void onUndo().then(description => {
          if (description) {
            onShowUndoToast(`Undone: ${description}`);
          }
        });
      },
      canUndo
    ),

    // Redo (Cmd+Shift+Z / Ctrl+Shift+Z)
    CommonShortcuts.redo(
      () => {
        void onRedo().then(description => {
          if (description) {
            onShowUndoToast(`Redone: ${description}`);
          }
        });
      },
      canRedo
    ),
  ];

  useKeyboardShortcuts(shortcuts);

  // This component doesn't render anything
  return null;
}
