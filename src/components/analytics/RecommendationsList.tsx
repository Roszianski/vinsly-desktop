import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Recommendation } from '../../utils/analytics';
import { WarningIcon } from '../icons/WarningIcon';
import { LightbulbIcon } from '../icons/LightbulbIcon';

interface RecommendationsListProps {
  recommendations: Recommendation[];
  maxHeight?: number;
}

type RecommendationSeverity = Recommendation['severity'];

const SEVERITY_STYLES: Record<
  RecommendationSeverity,
  { accent: string; surface: string; iconBg: string }
> = {
  high: {
    accent: '#B26F5D',
    surface: 'rgba(178, 111, 93, 0.12)',
    iconBg: 'rgba(178, 111, 93, 0.18)'
  },
  medium: {
    accent: '#C6A27C',
    surface: 'rgba(198, 162, 124, 0.14)',
    iconBg: 'rgba(198, 162, 124, 0.2)'
  },
  low: {
    accent: '#A5B1AE',
    surface: 'rgba(165, 177, 174, 0.12)',
    iconBg: 'rgba(165, 177, 174, 0.2)'
  }
};

const renderSeverityIcon = (severity: RecommendationSeverity, color: string) => {
  if (severity === 'high' || severity === 'medium') {
    return <WarningIcon className="h-5 w-5" style={{ color }} />;
  }
  return <LightbulbIcon className="h-5 w-5" style={{ color }} />;
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'performance':
      return 'Performance';
    case 'organization':
      return 'Organization';
    case 'security':
      return 'Security';
    default:
      return 'Recommendation';
  }
};

const severityOptions: { value: 'all' | RecommendationSeverity; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

export const RecommendationsList: React.FC<RecommendationsListProps> = ({ recommendations, maxHeight }) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | RecommendationSeverity>('all');
  const filteredRecommendations = useMemo(() => {
    if (severityFilter === 'all') return recommendations;
    return recommendations.filter(rec => rec.severity === severityFilter);
  }, [recommendations, severityFilter]);
  const activeFilterLabel =
    severityOptions.find(option => option.value === severityFilter)?.label ?? 'All';
  const emptyStateLabel =
    severityFilter === 'all'
      ? 'recommendations'
      : `${activeFilterLabel.toLowerCase()} recommendations`;

  const Header = () => (
    <div className="scroll-mt-24 flex-shrink-0">
      <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
        Recommendations
      </h3>
      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
        Actionable insights to improve your agents
      </p>
    </div>
  );

  if (recommendations.length === 0) {
    return (
      <div
        className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 h-full flex flex-col"
        style={maxHeight ? { height: maxHeight, minHeight: maxHeight } : undefined}
      >
        <Header />
        <div className="flex flex-col items-center justify-center py-12 text-center mt-6 flex-1">
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-v-light-text-primary dark:text-v-text-primary font-medium">
            All agents look good!
          </p>
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-2">
            No recommendations at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 h-full flex flex-col"
      style={maxHeight ? { height: maxHeight, minHeight: maxHeight } : undefined}
    >
      <Header />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {severityOptions.map(option => {
          const isActive = severityFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSeverityFilter(option.value)}
              className={`text-xs font-semibold rounded-full border px-3 py-1.5 transition-colors ${
                isActive
                  ? 'border-v-accent text-v-accent bg-v-accent/10'
                  : 'border-v-light-border/60 dark:border-v-border/60 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
              }`}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {filteredRecommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center text-sm text-v-light-text-secondary dark:text-v-text-secondary">
          No {emptyStateLabel} at this time.
        </div>
      ) : (
        <div className="mt-4 space-y-4 overflow-y-auto pr-2 flex-1">
          {filteredRecommendations.map((rec, index) => (
            <motion.div
              key={`${rec.agentId}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative rounded-xl border border-v-light-border/60 dark:border-v-border/60 shadow-sm overflow-hidden px-5 py-4"
              style={{ backgroundColor: SEVERITY_STYLES[rec.severity].surface }}
            >
              <span
                className="absolute inset-y-3 left-3 w-1 rounded-full"
                style={{ backgroundColor: SEVERITY_STYLES[rec.severity].accent }}
                aria-hidden="true"
              ></span>
              <div className="relative flex items-start gap-3 pl-6">
                <div
                  className="flex-shrink-0 mt-0.5 rounded-full p-2"
                  style={{
                    backgroundColor: SEVERITY_STYLES[rec.severity].iconBg,
                    color: SEVERITY_STYLES[rec.severity].accent
                  }}
                >
                  {renderSeverityIcon(rec.severity, SEVERITY_STYLES[rec.severity].accent)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: SEVERITY_STYLES[rec.severity].accent }}
                    >
                      {getTypeLabel(rec.type)}
                    </span>
                    {rec.agentName !== 'All agents' && (
                      <>
                        <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">•</span>
                        <span className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary truncate">
                          {rec.agentName}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-v-light-text-primary dark:text-v-text-primary leading-relaxed">
                    {rec.message}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
