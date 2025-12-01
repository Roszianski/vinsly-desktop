import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Agent } from '../../types';
import {
  calculateModelDistribution,
  calculateToolsBreakdown,
  calculateComplexityScores,
  generateRecommendations,
  calculateAnalyticsSummary
} from '../../utils/analytics';
import { MetricCard } from '../analytics/MetricCard';
import { ModelDistributionChart } from '../analytics/ModelDistributionChart';
import { ToolsBreakdownChart } from '../analytics/ToolsBreakdownChart';
import { ComplexityAnalysisChart } from '../analytics/ComplexityAnalysisChart';
import { AgentComplexityList } from '../analytics/AgentComplexityList';
import { RecommendationsList } from '../analytics/RecommendationsList';
import { LayersIcon } from '../icons/LayersIcon';
import { ChartIcon } from '../icons/ChartIcon';
import { ListIcon } from '../icons/ListIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { TerminalIcon } from '../icons/TerminalIcon';

interface AnalyticsDashboardScreenProps {
  agents: Agent[];
  onShowList: () => void;
  onShowSkills: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
}

export const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({
  agents,
  onShowList,
  onShowSkills,
  onShowMemory,
  onShowCommands
}) => {
  const [complexityHeight, setComplexityHeight] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const complexityCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsLargeScreen(event.matches);
    };
    handleChange(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange as (event: MediaQueryListEvent) => void);
      return () => mediaQuery.removeEventListener('change', handleChange as (event: MediaQueryListEvent) => void);
    }
    mediaQuery.addListener(handleChange as (event: MediaQueryListEvent) => void);
    return () => mediaQuery.removeListener(handleChange as (event: MediaQueryListEvent) => void);
  }, []);

  useEffect(() => {
    const node = complexityCardRef.current;
    if (!node) return;
    const updateHeight = (nextHeight: number) => {
      setComplexityHeight(prev => {
        if (prev === null || Math.abs(prev - nextHeight) > 0.5) {
          return nextHeight;
        }
        return prev;
      });
    };
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        const entry = entries[0];
        if (entry) {
          updateHeight(entry.contentRect.height);
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    }
    const handleResize = () => {
      updateHeight(node.getBoundingClientRect().height);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Calculate analytics data
  const modelDistribution = useMemo(() => calculateModelDistribution(agents), [agents]);
  const toolsBreakdown = useMemo(() => calculateToolsBreakdown(agents), [agents]);
  const complexityScores = useMemo(() => calculateComplexityScores(agents), [agents]);
  const recommendations = useMemo(() => generateRecommendations(agents), [agents]);
  const summary = useMemo(() => calculateAnalyticsSummary(agents), [agents]);

  return (
    <div className="space-y-6">
      {/* Header with View Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
            Insights and recommendations for your agent ecosystem
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
            {[
              { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" />, action: onShowList },
              { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" />, action: onShowSkills },
              { key: 'memory', label: 'Memory', icon: <DocumentIcon className="h-4 w-4" />, action: onShowMemory },
              { key: 'commands', label: 'Commands', icon: <TerminalIcon className="h-4 w-4" />, action: onShowCommands },
            ].map((item, index, array) => (
              <React.Fragment key={item.key}>
                <button
                  onClick={item.action}
                  title={item.label}
                  className="px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark"
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
                {index < array.length - 1 && (
                  <div className="w-px bg-v-light-border dark:bg-v-border opacity-50"></div>
                )}
              </React.Fragment>
            ))}
          </div>
          {/* Back to Subagents button */}
          <button
            onClick={onShowList}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-v-accent hover:text-v-accent-hover transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to List
          </button>
        </div>
      </div>

      {agents.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <ChartIcon className="h-16 w-16 text-v-light-text-secondary dark:text-v-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-lg text-v-light-text-primary dark:text-v-text-primary mb-2">
                No Agents Yet
              </p>
              <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                Create some agents to see analytics and insights
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Agents"
                value={summary.totalAgents}
                subtitle={`${summary.globalAgents} global, ${summary.projectAgents} project`}
                icon={<LayersIcon className="h-6 w-6" />}
              />
              <MetricCard
                title="Avg Complexity"
                value={summary.averageComplexity}
                subtitle="Lower is simpler"
                icon={<ChartIcon className="h-6 w-6" />}
              />
              <MetricCard
                title="Most Used Model"
                value={summary.mostUsedModel}
                subtitle="Across all agents"
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              <MetricCard
                title="Tool Categories"
                value={summary.toolCategories}
                subtitle="Read, Edit, Execute, Other"
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ModelDistributionChart data={modelDistribution} title="Model Distribution" itemLabel="agents" />
              <ToolsBreakdownChart data={toolsBreakdown} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
              <div
                ref={complexityCardRef}
                className="lg:col-span-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 h-full"
               
              >
                <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-6">
                  Agent Complexity Analysis
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-2">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary uppercase tracking-wide">
                        Agent Details
                      </h4>
                    </div>
                    <AgentComplexityList data={complexityScores} />
                  </div>
                  <div className="lg:col-span-3">
                    <ComplexityAnalysisChart data={complexityScores} hideTitle />
                  </div>
                </div>
              </div>
              <RecommendationsList
                recommendations={recommendations}
                maxHeight={isLargeScreen && complexityHeight ? Math.ceil(complexityHeight) : undefined}
              />
            </div>
          </div>
        )}
    </div>
  );
};
