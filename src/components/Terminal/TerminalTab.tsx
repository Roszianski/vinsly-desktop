import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon, ISearchOptions } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { TerminalSession } from '../../types/terminal';
import { useTerminal } from '../../contexts/TerminalContext';
import { Theme } from '../../hooks/useTheme';
import { TerminalContextMenu } from './TerminalContextMenu';
import { TerminalSearchBar } from './TerminalSearchBar';

interface TerminalTabProps {
  session: TerminalSession;
  isActive: boolean;
  panelHeight: number;
  theme: Theme;
}

const darkTheme: ITheme = {
  background: '#1f2229',
  foreground: '#e0e0e0',
  cursor: '#e0e0e0',
  cursorAccent: '#1f2229',
  selectionBackground: '#3d4450',
  selectionForeground: '#e0e0e0',
  black: '#1f2229',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#9a9faa',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#c8ccd4',
};

const lightTheme: ITheme = {
  background: '#f5f5f5',
  foreground: '#383a42',
  cursor: '#383a42',
  cursorAccent: '#f5f5f5',
  selectionBackground: '#bfceff',
  selectionForeground: '#383a42',
  black: '#383a42',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#4078f2',
  magenta: '#a626a4',
  cyan: '#0184bc',
  white: '#a0a1a7',
  brightBlack: '#696c77',
  brightRed: '#e45649',
  brightGreen: '#50a14f',
  brightYellow: '#c18401',
  brightBlue: '#4078f2',
  brightMagenta: '#a626a4',
  brightCyan: '#0184bc',
  brightWhite: '#696c77',
};

export const TerminalTab: React.FC<TerminalTabProps> = ({ session, isActive, panelHeight, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDimsRef = useRef<{ cols: number; rows: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchMatchCount, setSearchMatchCount] = useState<number | undefined>(undefined);
  const [currentSearchMatch, setCurrentSearchMatch] = useState<number | undefined>(undefined);
  const { subscribeToOutput, subscribeToExit, writeToTerminalSession, resizeTerminalSession, registerTerminal, unregisterTerminal, closeTerminalSession, fontSize } = useTerminal();

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopy = useCallback(() => {
    if (terminalRef.current) {
      const selection = terminalRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && terminalRef.current) {
        const encoded = btoa(text);
        writeToTerminalSession(session.id, encoded);
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }, [session.id, writeToTerminalSession]);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const handleSelectAll = useCallback(() => {
    terminalRef.current?.selectAll();
  }, []);

  const handleCloseTerminal = useCallback(() => {
    closeTerminalSession(session.id);
  }, [closeTerminalSession, session.id]);

  // Search handlers
  const handleSearch = useCallback((term: string) => {
    if (!searchAddonRef.current || !term) {
      setSearchMatchCount(undefined);
      setCurrentSearchMatch(undefined);
      return;
    }
    const options: ISearchOptions = {
      regex: false,
      wholeWord: false,
      caseSensitive: false,
      decorations: {
        matchBackground: theme === 'dark' ? '#614e1a' : '#ffdd9b',
        activeMatchBackground: theme === 'dark' ? '#515c6a' : '#a8c7fa',
        matchOverviewRuler: theme === 'dark' ? '#d18616' : '#f9a825',
        activeMatchColorOverviewRuler: theme === 'dark' ? '#a1a1a1' : '#616161',
      },
    };
    const found = searchAddonRef.current.findNext(term, options);
    // The search addon doesn't expose match count directly, but we can track if matches exist
    setSearchMatchCount(found ? 1 : 0);
    setCurrentSearchMatch(found ? 1 : 0);
  }, [theme]);

  const handleFindNext = useCallback(() => {
    if (!searchAddonRef.current) return;
    searchAddonRef.current.findNext('', { incremental: false });
    setCurrentSearchMatch(prev => prev !== undefined ? prev + 1 : 1);
  }, []);

  const handleFindPrevious = useCallback(() => {
    if (!searchAddonRef.current) return;
    searchAddonRef.current.findPrevious('', { incremental: false });
    setCurrentSearchMatch(prev => prev !== undefined && prev > 1 ? prev - 1 : 1);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    searchAddonRef.current?.clearDecorations();
    setSearchMatchCount(undefined);
    setCurrentSearchMatch(undefined);
    terminalRef.current?.focus();
  }, []);

  const contextMenuItems = [
    { label: 'Copy', shortcut: '⌘C', onClick: handleCopy, disabled: !terminalRef.current?.hasSelection() },
    { label: 'Paste', shortcut: '⌘V', onClick: handlePaste },
    { label: 'Select All', shortcut: '⌘A', onClick: handleSelectAll },
    { label: 'Find', shortcut: '⌘F', onClick: () => setShowSearch(true), divider: true },
    { label: 'Clear', shortcut: '⌘K', onClick: handleClear, divider: true },
    { label: 'Close Terminal', shortcut: '⌘W', onClick: handleCloseTerminal, divider: true },
  ];

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'outline',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: fontSize,
      lineHeight: 1.2,
      allowProposedApi: true,
      allowTransparency: false,
      // Force consistent rendering across dev and production
      overviewRulerWidth: 0,
      scrollback: 5000,
      theme: theme === 'dark' ? darkTheme : lightTheme,
    });

    // Force options after creation to ensure they're applied
    term.options.cursorBlink = true;
    term.options.cursorStyle = 'block';

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(searchAddon);

    term.open(containerRef.current);

    // Try to load WebGL addon for better rendering (especially cursor)
    // Falls back to canvas renderer if WebGL is not available
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
      console.log('[Terminal] WebGL renderer loaded successfully');
    } catch (e) {
      console.warn('[Terminal] WebGL not available, using canvas renderer:', e);
    }

    // Initial fit and focus
    setTimeout(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        lastDimsRef.current = { cols: dims.cols, rows: dims.rows };
        resizeTerminalSession(session.id, { cols: dims.cols, rows: dims.rows });
      }
      term.focus();
    }, 50);

    // Handle input - encode to base64 and send
    term.onData((data) => {
      const encoded = btoa(data);
      writeToTerminalSession(session.id, encoded);
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    return () => {
      try {
        term.dispose();
      } catch (e) {
        console.error('[Terminal] Error disposing terminal:', e);
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [session.id, writeToTerminalSession, resizeTerminalSession]);

  // Subscribe to output events
  useEffect(() => {
    const unsubscribe = subscribeToOutput(session.id, (data) => {
      if (terminalRef.current) {
        // Decode base64 to binary and write raw bytes to terminal
        try {
          const binaryString = atob(data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // Write raw bytes - xterm.js handles UTF-8 decoding internally
          terminalRef.current.write(bytes);
        } catch (e) {
          console.error('Failed to decode terminal output:', e);
        }
      }
    });

    return unsubscribe;
  }, [session.id, subscribeToOutput]);

  // Subscribe to exit events
  useEffect(() => {
    const unsubscribe = subscribeToExit(session.id, (exitCode) => {
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n[Process exited with code ${exitCode ?? 'unknown'}]\r\n`);
      }
    });

    return unsubscribe;
  }, [session.id, subscribeToExit]);

  // Store last panel height to detect actual changes
  const lastPanelHeightRef = useRef<number>(panelHeight);

  // Handle resize - only resize if dimensions actually changed
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (fitAddonRef.current && terminalRef.current && isActive) {
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          const lastDims = lastDimsRef.current;
          // Only fit and resize if dimensions actually changed
          if (!lastDims || lastDims.cols !== dims.cols || lastDims.rows !== dims.rows) {
            lastDimsRef.current = { cols: dims.cols, rows: dims.rows };
            fitAddonRef.current.fit();
            resizeTerminalSession(session.id, { cols: dims.cols, rows: dims.rows });
          }
        }
      }
    }, 150);
  }, [session.id, isActive, resizeTerminalSession]);

  // Listen for window resize
  useEffect(() => {
    const onWindowResize = () => handleResize();
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

  // Resize when panel height changes (from drag handle)
  useEffect(() => {
    if (lastPanelHeightRef.current !== panelHeight) {
      lastPanelHeightRef.current = panelHeight;
      handleResize();
    }
  }, [panelHeight, handleResize]);

  // Update terminal theme when app theme changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme;
    }
  }, [theme]);

  // Update terminal font size when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      // Refit after font size change and update PTY dimensions
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          lastDimsRef.current = { cols: dims.cols, rows: dims.rows };
          resizeTerminalSession(session.id, { cols: dims.cols, rows: dims.rows });
        }
      }
    }
  }, [fontSize, session.id, resizeTerminalSession]);

  // Register terminal for clear functionality
  useEffect(() => {
    if (terminalRef.current) {
      registerTerminal(session.id, {
        clear: () => {
          terminalRef.current?.clear();
        },
      });
    }
    return () => {
      unregisterTerminal(session.id);
    };
  }, [session.id, registerTerminal, unregisterTerminal]);

  // Focus terminal when it becomes active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isActive]);

  // Handle Cmd+F to open search
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierPressed = e.metaKey || e.ctrlKey;
      if (modifierPressed && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // Focus terminal when container is clicked
  const handleContainerClick = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  // Get the correct background color based on theme
  const terminalBgColor = theme === 'dark' ? '#1f2229' : '#f5f5f5';

  return (
    <>
      <div className={`relative h-full w-full ${isActive ? 'block' : 'hidden'}`}>
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{
            padding: '4px 8px',
            backgroundColor: terminalBgColor,
          }}
          onClick={handleContainerClick}
          onContextMenu={handleContextMenu}
        />
        <TerminalSearchBar
          isVisible={showSearch}
          onClose={handleCloseSearch}
          onSearch={handleSearch}
          onFindNext={handleFindNext}
          onFindPrevious={handleFindPrevious}
          theme={theme}
          matchCount={searchMatchCount}
          currentMatch={currentSearchMatch}
        />
      </div>
      {contextMenu && (
        <TerminalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
          theme={theme}
        />
      )}
    </>
  );
};
