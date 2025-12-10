import React from 'react';
import { Agent, AgentScope, ToolRisk } from '../types';
import { AVAILABLE_TOOLS } from '../constants';
import { getToolsState } from '../utils/toolHelpers';

const RiskBadge: React.FC<{ risk: ToolRisk }> = ({ risk }) => {
    const riskColor = {
        [ToolRisk.Low]: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
        [ToolRisk.Medium]: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
        [ToolRisk.High]: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
        [ToolRisk.Unknown]: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${riskColor[risk]}`}>{risk}</span>;
};

const colorMap: { [key: string]: string } = {
  red: 'border-red-500',
  blue: 'border-blue-500',
  green: 'border-green-500',
  yellow: 'border-yellow-500',
  purple: 'border-purple-500',
  orange: 'border-orange-500',
  pink: 'border-pink-500',
  cyan: 'border-cyan-500',
};

const colorBgMap: { [key: string]: string } = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

interface AgentPreviewCardProps {
  agent: Agent;
  hideSystemPrompt?: boolean;
  systemPromptSlot?: React.ReactNode;
}

export const AgentPreviewCard: React.FC<AgentPreviewCardProps> = ({ agent, hideSystemPrompt, systemPromptSlot }) => {
  const borderColorClass = 'border-v-accent';
  const badgeColorClass = agent.frontmatter.color ? colorBgMap[agent.frontmatter.color] : '';

  const path = agent.scope === AgentScope.Project
    ? `.claude/agents/${agent.frontmatter.name || 'agent-name'}.md`
    : `~/.claude/agents/${agent.frontmatter.name || 'agent-name'}.md`;

  const toolsState = getToolsState(agent.frontmatter.tools);
  const toolsWithRisk = toolsState.list.map(toolName => {
    const toolInfo = AVAILABLE_TOOLS.find(t => t.name === toolName);
    return {
      name: toolName,
      risk: toolInfo ? toolInfo.risk : ToolRisk.Unknown,
    };
  });

  return (
    <div className={`bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}>
      <div className="p-6">
        {badgeColorClass ? (
          <span className={`inline-block px-1.5 py-0 rounded ${badgeColorClass}`}>
            <h3 className="font-mono text-lg font-bold text-white">{agent.frontmatter.name || <span className="italic">agent-name</span>}</h3>
          </span>
        ) : (
          <h3 className="font-mono text-lg font-bold text-v-light-text-primary dark:text-v-text-primary">{agent.frontmatter.name || <span className="italic text-v-text-secondary">agent-name</span>}</h3>
        )}
        <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-2">{agent.frontmatter.description || <span className="italic">Agent description...</span>}</p>
      </div>

      <div className="border-t border-v-light-border dark:border-v-border px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="block text-xs font-semibold uppercase text-v-light-text-secondary dark:text-v-text-secondary tracking-wider">Scope</span>
          <span className="font-medium text-v-light-text-primary dark:text-v-text-primary">{agent.scope}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-v-light-text-secondary dark:text-v-text-secondary tracking-wider">Model</span>
          <span className="font-mono text-v-light-text-primary dark:text-v-text-primary">{agent.frontmatter.model || 'default (sonnet)'}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-v-light-text-secondary dark:text-v-text-secondary tracking-wider">Path</span>
          <span className="font-mono text-v-light-text-primary dark:text-v-text-primary break-all">{path}</span>
        </div>
      </div>

      <div className="border-t border-v-light-border dark:border-v-border px-6 py-4">
        <h4 className="text-xs font-semibold uppercase text-v-light-text-secondary dark:text-v-text-secondary tracking-wider mb-3">Tools</h4>
        {toolsState.inheritsAll ? (
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary italic">All session tools inherited</p>
        ) : toolsWithRisk.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {toolsWithRisk.map(tool => (
              <div key={tool.name} className="flex items-center gap-2 bg-v-light-hover dark:bg-v-light-dark px-2 py-1 rounded-md">
                <span className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">{tool.name}</span>
                <RiskBadge risk={tool.risk} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary italic">No tools selected</p>
        )}
      </div>

      {!hideSystemPrompt && (
        <div className="border-t border-v-light-border dark:border-v-border px-6 py-4">
          <h4 className="text-xs font-semibold uppercase text-v-light-text-secondary dark:text-v-text-secondary tracking-wider mb-2">System Prompt</h4>
          <pre className="font-mono text-xs text-v-light-text-secondary dark:text-v-text-secondary bg-v-light-bg/50 dark:bg-v-dark/50 p-3 rounded-md custom-scrollbar max-h-32 overflow-y-auto">
            <code>{agent.body || <span className="italic">No system prompt provided.</span>}</code>
          </pre>
        </div>
      )}

      {systemPromptSlot && (
        <div className="border-t border-v-light-border dark:border-v-border px-6 py-4">
          {systemPromptSlot}
        </div>
      )}

    </div>
  );
};
