import React, { useState, useRef, useEffect } from 'react';
import { TerminalSession } from '../../types/terminal';
import { useTerminal } from '../../contexts/TerminalContext';
import { Theme } from '../../hooks/useTheme';

interface TerminalTabBarProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  theme: Theme;
}

export const TerminalTabBar: React.FC<TerminalTabBarProps> = ({ sessions, activeSessionId, theme }) => {
  const { setActiveTerminal, closeTerminalSession, createNewTerminal, closePanel, renameTerminalSession, clearActiveTerminal } = useTerminal();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const tabBarBg = isDark ? 'bg-v-mid-dark' : 'bg-gray-100';
  const activeTabBg = isDark ? 'bg-v-light-dark' : 'bg-white';
  const inactiveTabHover = isDark ? 'hover:bg-v-light-dark/50' : 'hover:bg-gray-200';
  const textPrimary = isDark ? 'text-v-text-primary' : 'text-gray-900';
  const textSecondary = isDark ? 'text-v-text-secondary' : 'text-gray-500';
  const buttonHover = isDark ? 'hover:bg-v-light-dark' : 'hover:bg-gray-200';
  const closeButtonHover = isDark ? 'hover:bg-v-border' : 'hover:bg-gray-300';
  const inputBg = isDark ? 'bg-v-dark' : 'bg-white';
  const inputBorder = isDark ? 'border-v-accent' : 'border-blue-500';

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleNewTerminal = async () => {
    try {
      await createNewTerminal();
    } catch (error) {
      console.error('[TerminalTabBar] Failed to create terminal:', error);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    closeTerminalSession(sessionId);
  };

  const handleDoubleClick = (session: TerminalSession, index: number) => {
    setEditingTabId(session.id);
    setEditingValue(session.title || `Terminal ${index + 1}`);
  };

  const handleRenameSubmit = () => {
    if (editingTabId && editingValue.trim()) {
      renameTerminalSession(editingTabId, editingValue.trim());
    }
    setEditingTabId(null);
    setEditingValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingValue('');
    }
  };

  return (
    <div className={`flex items-center justify-between border-b border-v-border ${tabBarBg} px-2 py-1`}>
      <div className="flex items-center gap-1 overflow-x-auto">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded text-sm whitespace-nowrap
              transition-colors duration-150 cursor-pointer
              ${
                session.id === activeSessionId
                  ? `${activeTabBg} ${textPrimary}`
                  : `${textSecondary} ${inactiveTabHover}`
              }
            `}
            onClick={() => setActiveTerminal(session.id)}
          >
            <span className={textSecondary}>$</span>
            {editingTabId === session.id ? (
              <input
                ref={inputRef}
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                className={`w-24 px-1 py-0 text-sm rounded border ${inputBg} ${inputBorder} ${textPrimary} outline-none`}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={() => handleDoubleClick(session, index)}
                title="Double-click to rename"
              >
                {session.title || `Terminal ${index + 1}`}
              </span>
            )}
            <button
              onClick={(e) => handleCloseTab(e, session.id)}
              className={`p-0.5 rounded ${closeButtonHover} ${textSecondary} transition-colors`}
              title="Close terminal"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={handleNewTerminal}
          className={`flex items-center justify-center w-7 h-7 rounded ${textSecondary} ${buttonHover} transition-colors`}
          title="New terminal (⌘+Shift+`)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 3v8M3 7h8" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Clear terminal button */}
        <button
          onClick={clearActiveTerminal}
          className={`flex items-center justify-center w-7 h-7 rounded ${textSecondary} ${buttonHover} transition-colors`}
          title="Clear terminal (⌘+K)"
          disabled={sessions.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h10M4 4V3a1 1 0 011-1h4a1 1 0 011 1v1M5 7v4M9 7v4M3 4l1 8a1 1 0 001 1h4a1 1 0 001-1l1-8" />
          </svg>
        </button>
        {/* Close panel button */}
        <button
          onClick={closePanel}
          className={`flex items-center justify-center w-7 h-7 rounded ${textSecondary} ${buttonHover} transition-colors`}
          title="Close panel (⌘+`)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5l4 4 4-4" />
          </svg>
        </button>
      </div>
    </div>
  );
};
