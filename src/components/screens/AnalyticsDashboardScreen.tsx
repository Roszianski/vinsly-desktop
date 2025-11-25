import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Agent, AgentScope, Skill } from '../../types';
import {
  calculateModelDistribution,
  calculateToolsBreakdown,
  calculateComplexityScores,
  generateRecommendations,
  calculateAnalyticsSummary,
  calculateSkillSummary,
  calculateSkillToolsBreakdown,
  calculateSkillLicenseDistribution
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
import { NetworkIcon } from '../icons/NetworkIcon';

interface AnalyticsDashboardScreenProps {
  agents: Agent[];
  skills: Skill[];
  onShowList: () => void;
  onShowTeam: () => void;
  onShowSkills: () => void;
}

export const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({
  agents,
  skills,
  onShowList,
  onShowTeam,
  onShowSkills
}) => {
  const [analyticsView, setAnalyticsView] = useState<'agents' | 'skills'>('agents');
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

  const skillSummary = useMemo(() => calculateSkillSummary(skills), [skills]);
  const skillToolsBreakdown = useMemo(() => calculateSkillToolsBreakdown(skills), [skills]);
  const skillLicenseDistribution = useMemo(() => calculateSkillLicenseDistribution(skills), [skills]);
  const skillLengthRanking = useMemo(
    () =>
      [...skills]
        .map(skill => ({
          id: skill.id,
          name: skill.name,
          scope: skill.scope,
          bodyLength: skill.body?.length || 0,
          hasAssets: !!skill.hasAssets,
          license: typeof skill.frontmatter.license === 'string' && skill.frontmatter.license.trim().length > 0
            ? skill.frontmatter.license.trim()
            : 'Unspecified',
        }))
        .sort((a, b) => b.bodyLength - a.bodyLength)
        .slice(0, 6),
    [skills]
  );
  const skillRecommendations = useMemo(() => {
    const recs: { message: string; severity: 'low' | 'medium' | 'high' }[] = [];
    const unspecified = skills.filter(
      s => !s.frontmatter.license || (typeof s.frontmatter.license === 'string' && s.frontmatter.license.trim().length === 0)
    ).length;
    if (skillSummary.withAssets === 0) {
      recs.push({ message: 'None of your skills have assets bundled. Add supporting assets where useful.', severity: 'medium' });
    }
    if (unspecified > 0) {
      recs.push({ message: `${unspecified} skill(s) lack a licence declaration. Add a license to clarify reuse.`, severity: 'low' });
    }
    if (skillSummary.averageBodyLength > 2500) {
      recs.push({ message: 'Average skill content exceeds 2.5k chars. Consider splitting large SKILL.md files for readability.', severity: 'medium' });
    }
    if (skills.length > 0 && skillSummary.globalSkills === 0) {
      recs.push({ message: 'All skills are project-scoped. Create global skills to reuse patterns across projects.', severity: 'low' });
    }
    return recs;
  }, [skills, skillSummary]);

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
        <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
          {[
            { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" />, action: onShowList },
            { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" />, action: onShowSkills },
            { key: 'team', label: 'Swarm View', icon: <NetworkIcon className="h-4 w-4" />, action: onShowTeam },
            { key: 'analytics', label: 'Analytics', icon: <ChartIcon className="h-4 w-4" />, action: () => {} },
          ].map((item, index, array) => (
            <React.Fragment key={item.key}>
              <button
                onClick={item.action}
                title={item.label}
                className={`px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
                  item.key === 'analytics'
                    ? 'bg-v-accent/10 text-v-accent'
                    : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-accent/10 dark:hover:bg-v-light-dark'
                }`}
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
      </div>

      {/* Analytics view toggle */}
      <div className="flex items-center gap-2 mt-4">
        {[
          { key: 'agents', label: 'Subagents Analytics' },
          { key: 'skills', label: 'Skills Analytics' },
        ].map(view => (
          <button
            key={view.key}
            onClick={() => setAnalyticsView(view.key as 'agents' | 'skills')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all border ${
              analyticsView === view.key
                ? 'bg-v-accent text-white border-v-accent shadow-sm'
                : 'bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/40 hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {analyticsView === 'agents' ? (
        agents.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="analytics-summary">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="analytics-charts">
              <ModelDistributionChart data={modelDistribution} title="Model Distribution" itemLabel="agents" />
              <ToolsBreakdownChart data={toolsBreakdown} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
              <div
                ref={complexityCardRef}
                className="lg:col-span-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 h-full"
                data-tour="analytics-complexity"
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
        )
      ) : skills.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <LayersIcon className="h-16 w-16 text-v-light-text-secondary dark:text-v-text-secondary mx-auto mb-4 opacity-50" />
            <p className="text-lg text-v-light-text-primary dark:text-v-text-primary mb-2">
              No Skills Yet
            </p>
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Import or create skills to view analytics
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="analytics-summary">
            <MetricCard
              title="Total Skills"
              value={skillSummary.totalSkills}
              subtitle={`${skillSummary.globalSkills} global, ${skillSummary.projectSkills} project`}
              icon={<LayersIcon className="h-6 w-6" />}
            />
            <MetricCard
              title="With Assets"
              value={skillSummary.withAssets}
              subtitle="Skills containing bundled assets"
              icon={<NetworkIcon className="h-6 w-6" />}
            />
            <MetricCard
              title="Avg Body Length"
              value={skillSummary.averageBodyLength}
              subtitle="Characters per SKILL.md"
              icon={<ChartIcon className="h-6 w-6" />}
            />
            <MetricCard
              title="Top Licence"
              value={skillSummary.mostCommonLicense}
              subtitle="Most common licence across skills"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h10" />
                </svg>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="analytics-charts">
            <ModelDistributionChart
              data={skillLicenseDistribution}
              title="Licence/Type Distribution"
              itemLabel="skills"
            />
            <ToolsBreakdownChart
              data={skillToolsBreakdown}
              title="Allowed Tools Breakdown"
              subtitle="Distribution of allowed tools across all skills"
              itemLabel="Skills"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
            <div className="lg:col-span-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 h-full">
              <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-2">
                Skill Content Snapshot
              </h3>
              <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-4">
                Longest SKILL.md files and whether assets/licence are set.
              </p>
              <div className="divide-y divide-v-light-border/70 dark:divide-v-border/70">
                {skillLengthRanking.map(skill => (
                  <div key={skill.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary truncate">
                        {skill.name}
                      </p>
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                        {skill.scope} • {skill.license}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                      <span className="px-2 py-1 rounded-full bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border">
                        {skill.bodyLength} chars
                      </span>
                      <span className={`px-2 py-1 rounded-full border ${skill.hasAssets ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-v-light-border dark:border-v-border'}`}>
                        {skill.hasAssets ? 'Assets' : 'No Assets'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 h-full">
              <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-2">
                Recommendations
              </h3>
              <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-4">
                Quick quality checks for your skills library.
              </p>
              <ul className="space-y-3">
                {skillRecommendations.length === 0 ? (
                  <li className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">No issues detected.</li>
                ) : (
                  skillRecommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-v-light-text-primary dark:text-v-text-primary flex items-start gap-2"
                    >
                      <span
                        className={`mt-1 h-2 w-2 rounded-full ${
                          rec.severity === 'high'
                            ? 'bg-red-500'
                            : rec.severity === 'medium'
                              ? 'bg-amber-500'
                              : 'bg-v-accent'
                        }`}
                      />
                      <span>{rec.message}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
