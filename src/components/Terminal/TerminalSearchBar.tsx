import React, { useRef, useEffect, useState } from 'react';
import { Theme } from '../../hooks/useTheme';

interface TerminalSearchBarProps {
  isVisible: boolean;
  onClose: () => void;
  onSearch: (term: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  theme: Theme;
  matchCount?: number;
  currentMatch?: number;
}

export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({
  isVisible,
  onClose,
  onSearch,
  onFindNext,
  onFindPrevious,
  theme,
  matchCount,
  currentMatch,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-v-mid-dark' : 'bg-gray-100';
  const inputBg = isDark ? 'bg-v-dark' : 'bg-white';
  const inputBorder = isDark ? 'border-v-border' : 'border-gray-300';
  const textPrimary = isDark ? 'text-v-text-primary' : 'text-gray-900';
  const textSecondary = isDark ? 'text-v-text-secondary' : 'text-gray-500';
  const buttonHover = isDark ? 'hover:bg-v-light-dark' : 'hover:bg-gray-200';
  const focusRing = isDark ? 'focus:ring-v-accent' : 'focus:ring-blue-500';

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      setSearchTerm('');
    }
  }, [isVisible]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onFindPrevious();
      } else {
        onFindNext();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  if (!isVisible) return null;

  return (
    <div className={`absolute top-0 right-0 z-10 ${bgColor} border-b border-l border-v-border rounded-bl-md shadow-lg`}>
      <div className="flex items-center gap-1 p-2">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Find"
          className={`w-48 px-2 py-1 text-sm rounded border ${inputBg} ${inputBorder} ${textPrimary} outline-none focus:ring-1 ${focusRing}`}
        />
        {searchTerm && matchCount !== undefined && (
          <span className={`text-xs ${textSecondary} min-w-[60px] text-center`}>
            {matchCount === 0 ? 'No results' : `${currentMatch ?? 0}/${matchCount}`}
          </span>
        )}
        <button
          onClick={onFindPrevious}
          disabled={!searchTerm || matchCount === 0}
          className={`p-1 rounded ${textSecondary} ${buttonHover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          title="Previous match (Shift+Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 9L7 5L3 9" />
          </svg>
        </button>
        <button
          onClick={onFindNext}
          disabled={!searchTerm || matchCount === 0}
          className={`p-1 rounded ${textSecondary} ${buttonHover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          title="Next match (Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5L7 9L11 5" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className={`p-1 rounded ${textSecondary} ${buttonHover} transition-colors`}
          title="Close (Escape)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};
