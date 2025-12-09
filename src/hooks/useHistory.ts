/**
 * Undo/Redo history management using Command pattern
 * Supports reversible operations with keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
 */

import { useState, useCallback, useRef } from 'react';
import { devLog } from '../utils/devLogger';

/**
 * Command interface - all undoable operations must implement this
 */
export interface Command {
  /**
   * Execute the command
   */
  execute: () => void | Promise<void>;

  /**
   * Undo the command
   */
  undo: () => void | Promise<void>;

  /**
   * Description for user feedback
   */
  description: string;

  /**
   * Optional: Called when command is removed from history
   */
  cleanup?: () => void;
}

/**
 * History configuration
 */
interface HistoryConfig {
  maxStackSize?: number;
  onStackChange?: (canUndo: boolean, canRedo: boolean) => void;
}

/**
 * Hook for managing undo/redo history
 */
export function useHistory(config: HistoryConfig = {}) {
  const { maxStackSize = 20, onStackChange } = config;

  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);
  const isExecutingRef = useRef(false);

  /**
   * Get current state
   */
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  /**
   * Notify listeners when stacks change
   */
  const notifyChange = useCallback(() => {
    onStackChange?.(undoStack.length > 0, redoStack.length > 0);
  }, [undoStack.length, redoStack.length, onStackChange]);

  /**
   * Execute a new command and add to history
   */
  const executeCommand = useCallback(async (command: Command): Promise<boolean> => {
    if (isExecutingRef.current) {
      devLog.warn('Command already executing, skipping');
      return false;
    }

    isExecutingRef.current = true;

    try {
      // Execute the command
      await command.execute();

      // Add to undo stack
      setUndoStack(prev => {
        const newStack = [...prev, command];

        // Limit stack size
        if (newStack.length > maxStackSize) {
          const removed = newStack.shift();
          removed?.cleanup?.();
        }

        return newStack;
      });

      // Clear redo stack when new command is executed
      setRedoStack(prev => {
        // Cleanup commands being cleared
        prev.forEach(cmd => cmd.cleanup?.());
        return [];
      });

      notifyChange();
      return true;
    } catch (error) {
      devLog.error('Failed to execute command:', error);
      return false;
    } finally {
      isExecutingRef.current = false;
    }
  }, [maxStackSize, notifyChange]);

  /**
   * Undo the last command
   */
  const undo = useCallback(async (): Promise<string | null> => {
    if (!canUndo || isExecutingRef.current) {
      return null;
    }

    isExecutingRef.current = true;

    try {
      const command = undoStack[undoStack.length - 1];

      // Execute undo
      await command.undo();

      // Move command to redo stack
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, command]);

      notifyChange();
      return command.description;
    } catch (error) {
      devLog.error('Failed to undo command:', error);
      return null;
    } finally {
      isExecutingRef.current = false;
    }
  }, [canUndo, undoStack, notifyChange]);

  /**
   * Redo the last undone command
   */
  const redo = useCallback(async (): Promise<string | null> => {
    if (!canRedo || isExecutingRef.current) {
      return null;
    }

    isExecutingRef.current = true;

    try {
      const command = redoStack[redoStack.length - 1];

      // Execute redo (same as execute)
      await command.execute();

      // Move command back to undo stack
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, command]);

      notifyChange();
      return command.description;
    } catch (error) {
      devLog.error('Failed to redo command:', error);
      return null;
    } finally {
      isExecutingRef.current = false;
    }
  }, [canRedo, redoStack, notifyChange]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    // Cleanup all commands
    undoStack.forEach(cmd => cmd.cleanup?.());
    redoStack.forEach(cmd => cmd.cleanup?.());

    setUndoStack([]);
    setRedoStack([]);
    notifyChange();
  }, [undoStack, redoStack, notifyChange]);

  /**
   * Get the description of the next undo/redo action
   */
  const getUndoDescription = useCallback((): string | null => {
    if (undoStack.length === 0) return null;
    return undoStack[undoStack.length - 1].description;
  }, [undoStack]);

  const getRedoDescription = useCallback((): string | null => {
    if (redoStack.length === 0) return null;
    return redoStack[redoStack.length - 1].description;
  }, [redoStack]);

  return {
    // State
    canUndo,
    canRedo,
    historySize: undoStack.length,

    // Actions
    executeCommand,
    undo,
    redo,
    clear,

    // Descriptions
    getUndoDescription,
    getRedoDescription,
  };
}

/**
 * Helper to create a simple command
 */
export function createCommand(
  description: string,
  execute: () => void | Promise<void>,
  undo: () => void | Promise<void>,
  cleanup?: () => void
): Command {
  return { description, execute, undo, cleanup };
}

/**
 * Factory for common command types
 */
export const CommandFactory = {
  /**
   * Create a delete command
   */
  delete: <T>(
    item: T,
    description: string,
    onDelete: (item: T) => void | Promise<void>,
    onRestore: (item: T) => void | Promise<void>
  ): Command => ({
    description,
    execute: () => onDelete(item),
    undo: () => onRestore(item),
  }),

  /**
   * Create a bulk delete command
   */
  bulkDelete: <T>(
    items: T[],
    description: string,
    onDelete: (items: T[]) => void | Promise<void>,
    onRestore: (items: T[]) => void | Promise<void>
  ): Command => ({
    description,
    execute: () => onDelete(items),
    undo: () => onRestore(items),
  }),

  /**
   * Create an update command
   */
  update: <T>(
    oldValue: T,
    newValue: T,
    description: string,
    onUpdate: (value: T) => void | Promise<void>
  ): Command => ({
    description,
    execute: () => onUpdate(newValue),
    undo: () => onUpdate(oldValue),
  }),

  /**
   * Create a toggle command (for boolean properties)
   */
  toggle: (
    description: string,
    onToggle: () => void | Promise<void>
  ): Command => ({
    description,
    execute: onToggle,
    undo: onToggle, // Toggle is its own inverse
  }),
};
