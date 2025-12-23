import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import { TerminalSession, TerminalPanelState, TerminalOutputEvent, TerminalExitEvent, TerminalSize } from '../types/terminal';
import { createTerminal, closeTerminal, closeAllTerminals, writeToTerminal, resizeTerminal } from '../utils/terminalCommands';
import { getStorageItem, setStorageItem } from '../utils/storage';

const STORAGE_KEY_PANEL_STATE = 'terminal-panel-state';
const DEFAULT_PANEL_HEIGHT = 300;
const MIN_PANEL_HEIGHT = 150;
const MAX_PANEL_HEIGHT = 600;
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 24;

interface TerminalContextType {
  // Panel state
  isOpen: boolean;
  panelHeight: number;
  fontSize: number;

  // Sessions
  sessions: TerminalSession[];
  activeSessionId: string | null;

  // Panel actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setPanelHeight: (height: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;

  // Terminal operations
  createNewTerminal: (workingDir?: string) => Promise<string | null>;
  closeTerminalSession: (id: string) => Promise<void>;
  closeActiveTerminal: () => Promise<void>;
  setActiveTerminal: (id: string) => void;
  renameTerminalSession: (id: string, title: string) => void;
  writeToTerminalSession: (id: string, data: string) => Promise<void>;
  resizeTerminalSession: (id: string, size: TerminalSize) => Promise<void>;
  clearActiveTerminal: () => void;

  // Event subscriptions
  subscribeToOutput: (terminalId: string, callback: (data: string) => void) => () => void;
  subscribeToExit: (terminalId: string, callback: (exitCode: number | null) => void) => () => void;

  // Terminal registration (for features like clear)
  registerTerminal: (id: string, ref: { clear: () => void }) => void;
  unregisterTerminal: (id: string) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelHeight, setPanelHeightState] = useState(DEFAULT_PANEL_HEIGHT);
  const [fontSize, setFontSizeState] = useState(DEFAULT_FONT_SIZE);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Store output callbacks per terminal
  const outputCallbacksRef = useRef<Map<string, Set<(data: string) => void>>>(new Map());
  const exitCallbacksRef = useRef<Map<string, Set<(exitCode: number | null) => void>>>(new Map());
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const loadState = async () => {
      const savedState = await getStorageItem<TerminalPanelState>(STORAGE_KEY_PANEL_STATE);
      if (savedState) {
        setPanelHeightState(savedState.height || DEFAULT_PANEL_HEIGHT);
        setFontSizeState(savedState.fontSize || DEFAULT_FONT_SIZE);
        // Don't restore isOpen - start closed each session
      }
    };
    loadState();
  }, []);

  // Set up global event listeners (only once on mount)
  useEffect(() => {
    let isMounted = true;
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    const setupListeners = async () => {
      // Listen for terminal output
      unlistenOutput = await listen<TerminalOutputEvent>('terminal:output', (event) => {
        if (!isMounted) return;
        const { terminal_id, data } = event.payload;
        const callbacks = outputCallbacksRef.current.get(terminal_id);
        if (callbacks) {
          callbacks.forEach(cb => cb(data));
        }
      });

      // Listen for terminal exit
      unlistenExit = await listen<TerminalExitEvent>('terminal:exit', (event) => {
        if (!isMounted) return;
        const { terminal_id, exit_code } = event.payload;
        const callbacks = exitCallbacksRef.current.get(terminal_id);
        if (callbacks) {
          callbacks.forEach(cb => cb(exit_code));
        }
        // Remove session on exit
        setSessions(prev => prev.filter(s => s.id !== terminal_id));
        // If this was the active session, switch to another
        setActiveSessionId(prev => {
          if (prev === terminal_id) {
            // Use functional update to get current sessions
            setSessions(currentSessions => {
              const remaining = currentSessions.filter(s => s.id !== terminal_id);
              if (remaining.length > 0) {
                setActiveSessionId(remaining[remaining.length - 1].id);
              }
              return currentSessions; // Don't actually modify, just reading
            });
            return null;
          }
          return prev;
        });
      });
    };

    setupListeners();

    return () => {
      isMounted = false;
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, []); // Empty deps - only run once on mount

  // Clean up all terminals on unmount
  useEffect(() => {
    return () => {
      closeAllTerminals().catch(console.error);
    };
  }, []);

  // Persist panel state
  const persistState = useCallback(async (height: number, fontSizeVal: number) => {
    const state: TerminalPanelState = {
      isOpen: false, // Don't persist open state
      height,
      activeTabId: null,
      fontSize: fontSizeVal,
    };
    await setStorageItem(STORAGE_KEY_PANEL_STATE, state);
  }, []);

  // Panel actions
  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setPanelHeight = useCallback((height: number) => {
    const clampedHeight = Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, height));
    setPanelHeightState(clampedHeight);
    setFontSizeState(currentFontSize => {
      persistState(clampedHeight, currentFontSize);
      return currentFontSize;
    });
  }, [persistState]);

  const increaseFontSize = useCallback(() => {
    setFontSizeState(prev => {
      const newSize = Math.min(MAX_FONT_SIZE, prev + 1);
      setPanelHeightState(currentHeight => {
        persistState(currentHeight, newSize);
        return currentHeight;
      });
      return newSize;
    });
  }, [persistState]);

  const decreaseFontSize = useCallback(() => {
    setFontSizeState(prev => {
      const newSize = Math.max(MIN_FONT_SIZE, prev - 1);
      setPanelHeightState(currentHeight => {
        persistState(currentHeight, newSize);
        return currentHeight;
      });
      return newSize;
    });
  }, [persistState]);

  const resetFontSize = useCallback(() => {
    setFontSizeState(DEFAULT_FONT_SIZE);
    setPanelHeightState(currentHeight => {
      persistState(currentHeight, DEFAULT_FONT_SIZE);
      return currentHeight;
    });
  }, [persistState]);

  // Terminal operations
  const createNewTerminal = useCallback(async (workingDir?: string): Promise<string | null> => {
    // If no working directory provided, prompt user to select one
    let selectedDir = workingDir;
    if (!selectedDir) {
      const selected = await openFolderDialog({
        directory: true,
        multiple: false,
        title: 'Select Terminal Working Directory',
      });
      if (!selected || typeof selected !== 'string') {
        // User cancelled the dialog
        return null;
      }
      selectedDir = selected;
    }

    try {
      console.log('[Terminal] Creating new terminal...', { workingDir: selectedDir });
      const id = await createTerminal(selectedDir, undefined, 80, 24);
      console.log('[Terminal] Created terminal with id:', id);
      const session: TerminalSession = {
        id,
        title: selectedDir.split('/').pop() || 'Terminal',
        workingDirectory: selectedDir,
        createdAt: new Date(),
      };
      setSessions(prev => [...prev, session]);
      setActiveSessionId(id);
      setIsOpen(true);
      return id;
    } catch (error) {
      console.error('[Terminal] Failed to create terminal:', error);
      throw error;
    }
  }, []);

  const closeTerminalSession = useCallback(async (id: string) => {
    await closeTerminal(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionId(prev => {
      if (prev === id) {
        const remaining = sessions.filter(s => s.id !== id);
        return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      return prev;
    });
  }, [sessions]);

  const setActiveTerminal = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const renameTerminalSession = useCallback((id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  }, []);

  const writeToTerminalSession = useCallback(async (id: string, data: string) => {
    await writeToTerminal(id, data);
  }, []);

  const resizeTerminalSession = useCallback(async (id: string, size: TerminalSize) => {
    await resizeTerminal(id, size.cols, size.rows);
  }, []);

  const closeActiveTerminal = useCallback(async () => {
    if (activeSessionId) {
      await closeTerminalSession(activeSessionId);
    }
  }, [activeSessionId, closeTerminalSession]);

  // Store terminal refs for clearing - this will be populated by TerminalTab
  const terminalRefsRef = useRef<Map<string, { clear: () => void }>>(new Map());

  const clearActiveTerminal = useCallback(() => {
    if (activeSessionId) {
      const terminalRef = terminalRefsRef.current.get(activeSessionId);
      if (terminalRef) {
        terminalRef.clear();
      }
    }
  }, [activeSessionId]);

  const registerTerminal = useCallback((id: string, ref: { clear: () => void }) => {
    terminalRefsRef.current.set(id, ref);
  }, []);

  const unregisterTerminal = useCallback((id: string) => {
    terminalRefsRef.current.delete(id);
  }, []);

  // Event subscriptions
  const subscribeToOutput = useCallback((terminalId: string, callback: (data: string) => void) => {
    if (!outputCallbacksRef.current.has(terminalId)) {
      outputCallbacksRef.current.set(terminalId, new Set());
    }
    outputCallbacksRef.current.get(terminalId)!.add(callback);

    return () => {
      outputCallbacksRef.current.get(terminalId)?.delete(callback);
    };
  }, []);

  const subscribeToExit = useCallback((terminalId: string, callback: (exitCode: number | null) => void) => {
    if (!exitCallbacksRef.current.has(terminalId)) {
      exitCallbacksRef.current.set(terminalId, new Set());
    }
    exitCallbacksRef.current.get(terminalId)!.add(callback);

    return () => {
      exitCallbacksRef.current.get(terminalId)?.delete(callback);
    };
  }, []);

  return (
    <TerminalContext.Provider
      value={{
        isOpen,
        panelHeight,
        fontSize,
        sessions,
        activeSessionId,
        togglePanel,
        openPanel,
        closePanel,
        setPanelHeight,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        createNewTerminal,
        closeTerminalSession,
        closeActiveTerminal,
        setActiveTerminal,
        renameTerminalSession,
        writeToTerminalSession,
        resizeTerminalSession,
        clearActiveTerminal,
        subscribeToOutput,
        subscribeToExit,
        registerTerminal,
        unregisterTerminal,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};
