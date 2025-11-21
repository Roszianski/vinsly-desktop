import React from 'react';
import { motion } from 'framer-motion';
import { ComplexityScore } from '../../utils/analytics';

interface AgentComplexityListProps {
  data: ComplexityScore[];
}

const COMPLEXITY_COLORS = {
  simple: '#A5B1AE',
  moderate: '#C6A27C',
  complex: '#B26F5D'
};

const COMPLEXITY_BADGE_STYLES: Record<keyof typeof COMPLEXITY_COLORS, React.CSSProperties> = {
  simple: {
    color: COMPLEXITY_COLORS.simple,
    backgroundColor: 'rgba(165, 177, 174, 0.18)'
  },
  moderate: {
    color: COMPLEXITY_COLORS.moderate,
    backgroundColor: 'rgba(198, 162, 124, 0.16)'
  },
  complex: {
    color: COMPLEXITY_COLORS.complex,
    backgroundColor: 'rgba(178, 111, 93, 0.18)'
  }
};

export const AgentComplexityList: React.FC<AgentComplexityListProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-v-light-text-secondary dark:text-v-text-secondary text-sm">
          No agent data available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {data.map((agent, index) => (
        <motion.div
          key={agent.agentId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border rounded-lg p-4 hover:border-v-accent/30 transition-colors"
        >
          {/* Agent Name and Level Badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: COMPLEXITY_COLORS[agent.level] }}
              />
              <h4 className="font-mono text-sm font-medium text-v-light-text-primary dark:text-v-text-primary truncate">
                {agent.agentName}
              </h4>
            </div>
            <span
              className="px-2 py-0.5 text-xs font-medium rounded capitalize"
              style={COMPLEXITY_BADGE_STYLES[agent.level]}
            >
              {agent.level}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Score:</span>
              <span className="ml-2 font-semibold text-v-light-text-primary dark:text-v-text-primary">
                {agent.score}
              </span>
            </div>
            <div>
              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Tools:</span>
              <span className="ml-2 font-medium text-v-light-text-primary dark:text-v-text-primary">
                {agent.inheritsAllTools ? 'All session tools' : agent.toolCount}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Prompt:</span>
              <span className="ml-2 font-medium text-v-light-text-primary dark:text-v-text-primary">
                {agent.promptLength} chars
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
