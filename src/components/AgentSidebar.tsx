import React, { useMemo, useState } from 'react';
import { Agent, AgentScope } from '../types';
import { getToolsState } from '../utils/toolHelpers';

interface AgentSidebarProps {
  agents: Agent[];
}

type ScopeFilter = 'all' | AgentScope;

const colorSwatch: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

const scopeChip: Record<AgentScope, string> = {
  [AgentScope.Project]: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  [AgentScope.Global]: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300',
};

const AgentSidebar: React.FC<AgentSidebarProps> = ({ agents }) => {
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesScope = scopeFilter === 'all' || agent.scope === scopeFilter;
      const matchesQuery = !query
        || agent.name.toLowerCase().includes(query)
        || agent.frontmatter.description?.toLowerCase().includes(query);
      return matchesScope && matchesQuery;
    });
  }, [agents, scopeFilter, searchQuery]);

  const grouped = useMemo(() => {
    return filteredAgents.reduce(
      (acc, agent) => {
        acc[agent.scope].push(agent);
        return acc;
      },
      {
        [AgentScope.Global]: [] as Agent[],
        [AgentScope.Project]: [] as Agent[],
      }
    );
  }, [filteredAgents]);

  const ScopeButton: React.FC<{ value: ScopeFilter; label: string }> = ({ value, label }) => (
    <button
      onClick={() => setScopeFilter(value)}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-150 border ${
        scopeFilter === value
          ? 'bg-v-accent text-white border-v-accent'
          : 'bg-transparent text-v-light-text-secondary dark:text-v-text-secondary border-v-light-border dark:border-v-border hover:border-v-accent'
      }`}
    >
      {label}
    </button>
  );

  const renderSection = (scope: AgentScope) => {
    const list = grouped[scope];
    if (list.length === 0) {
      return null;
    }

    return (
      <div key={scope} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">{scope} agents</h3>
          <span className={`px-2 py-0.5 text-xs rounded-full ${scopeChip[scope]}`}>{list.length}</span>
        </div>
        <div className="space-y-2">
          {list.map((agent) => {
            const colorClass = agent.frontmatter.color ? colorSwatch[agent.frontmatter.color] || 'bg-v-accent' : 'bg-transparent border border-v-light-border dark:border-v-border';
            const { inheritsAll, explicitNone, list } = getToolsState(agent.frontmatter.tools);
            const toolsText = inheritsAll
              ? 'All tools'
              : explicitNone
                ? 'No tools'
                : `${list.length} tool(s)`;

            return (
              <div
                key={agent.id || agent.path || agent.name}
                className="p-3 border border-v-light-border dark:border-v-border rounded-xl bg-v-light-surface dark:bg-v-mid-dark transition-all duration-200 transform hover:-translate-y-0.5 hover:border-v-accent shadow-sm hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} aria-hidden="true" />
                      <span className="font-mono text-sm text-v-light-text-primary dark:text-v-text-primary">{agent.name}</span>
                    </div>
                    <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary line-clamp-2">{agent.frontmatter.description || 'No description provided.'}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full tracking-wide uppercase ${scopeChip[agent.scope]}`}>{agent.scope}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-v-light-text-secondary dark:text-v-text-secondary">
                  <span className="font-mono">{agent.frontmatter.model || 'default (sonnet)'}</span>
                  <span>{toolsText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-4 h-full flex flex-col">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">Agents overview</h2>
        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
          Glance at existing agents while you configure the new one.
        </p>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search agent names"
          className="w-full px-3 py-2 text-sm bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border rounded-md focus:ring-2 focus:ring-v-accent focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <ScopeButton value="all" label={`All (${agents.length})`} />
        <ScopeButton value={AgentScope.Global} label="Global" />
        <ScopeButton value={AgentScope.Project} label="Project" />
      </div>

      <div className="mt-4 space-y-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        {renderSection(AgentScope.Global)}
        {renderSection(AgentScope.Project)}
        {filteredAgents.length === 0 && (
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">No agents match your filters.</p>
        )}
      </div>
    </div>
  );
};

export default AgentSidebar;
