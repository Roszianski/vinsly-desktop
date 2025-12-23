import React, { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTerminal } from '../../contexts/TerminalContext';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalTab } from './TerminalTab';
import { ResizeHandle } from './ResizeHandle';
import { Theme } from '../../hooks/useTheme';

interface TerminalPanelProps {
  theme: Theme;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ theme }) => {
  const { isOpen, panelHeight, sessions, activeSessionId, setPanelHeight } = useTerminal();

  const handleResize = useCallback(
    (deltaY: number) => {
      setPanelHeight(panelHeight + deltaY);
    },
    [panelHeight, setPanelHeight]
  );

  const bgColor = theme === 'dark' ? 'bg-[#1f2229]' : 'bg-[#f5f5f5]';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
          style={{ height: panelHeight }}
          className={`fixed bottom-0 left-0 right-0 z-50 ${bgColor} border-t border-v-border flex flex-col`}
        >
          <ResizeHandle onResize={handleResize} />
          <TerminalTabBar sessions={sessions} activeSessionId={activeSessionId} theme={theme} />
          <div className="flex-1 overflow-hidden relative">
            {sessions.length === 0 ? (
              <div className="flex items-center justify-center h-full text-v-text-secondary">
                <div className="text-center">
                  <p>No terminals open</p>
                  <p className="text-sm mt-1 opacity-70">Click + to create a new terminal</p>
                </div>
              </div>
            ) : (
              sessions.map((session) => (
                <TerminalTab
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  panelHeight={panelHeight}
                  theme={theme}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
