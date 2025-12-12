import React from 'react';
import { ListIcon } from './icons/ListIcon';
import { LayersIcon } from './icons/LayersIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { TerminalIcon } from './icons/TerminalIcon';
import { ServerIcon } from './icons/ServerIcon';
import { LightningIcon } from './icons/LightningIcon';

export type TabView = 'subagents' | 'skills' | 'memory' | 'commands' | 'mcp' | 'hooks';

interface NavigationTabsProps {
  activeView: string;
  onNavigate: (view: TabView) => void;
}

const tabs: { key: TabView; label: string; icon: React.ReactNode }[] = [
  { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" /> },
  { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" /> },
  { key: 'memory', label: 'Memory', icon: <DocumentIcon className="h-4 w-4" /> },
  { key: 'commands', label: 'Commands', icon: <TerminalIcon className="h-4 w-4" /> },
  { key: 'mcp', label: 'MCP', icon: <ServerIcon className="h-4 w-4" /> },
  { key: 'hooks', label: 'Hooks', icon: <LightningIcon className="h-4 w-4" /> },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeView,
  onNavigate,
}) => {
  return (
    <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
      {tabs.map((tab, index) => (
        <React.Fragment key={tab.key}>
          <button
            onClick={() => onNavigate(tab.key)}
            className={`px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
              activeView === tab.key
                ? 'bg-v-accent/10 text-v-accent'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-accent/10 dark:hover:bg-v-light-dark'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
          {index < tabs.length - 1 && (
            <div className="w-px bg-v-light-border dark:bg-v-border opacity-50" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
