import React, { useEffect, useRef } from 'react';
import { Theme } from '../../hooks/useTheme';

interface ContextMenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface TerminalContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  theme: Theme;
}

export const TerminalContextMenu: React.FC<TerminalContextMenuProps> = ({ x, y, items, onClose, theme }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const menuBg = isDark ? 'bg-v-mid-dark' : 'bg-white';
  const menuBorder = isDark ? 'border-v-border' : 'border-gray-200';
  const textPrimary = isDark ? 'text-v-text-primary' : 'text-gray-900';
  const textSecondary = isDark ? 'text-v-text-secondary' : 'text-gray-500';
  const hoverBg = isDark ? 'hover:bg-v-light-dark' : 'hover:bg-gray-100';
  const disabledText = isDark ? 'text-v-text-secondary/50' : 'text-gray-300';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className={`fixed z-[100] min-w-[160px] py-1 rounded-md shadow-lg border ${menuBg} ${menuBorder}`}
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider && index > 0 && (
            <div className={`my-1 border-t ${menuBorder}`} />
          )}
          <button
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`
              w-full px-3 py-1.5 text-sm text-left flex items-center justify-between
              ${item.disabled ? disabledText : `${textPrimary} ${hoverBg}`}
              transition-colors
            `}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className={textSecondary}>{item.shortcut}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
