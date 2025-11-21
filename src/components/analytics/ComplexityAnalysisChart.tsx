import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis } from 'recharts';
import { ComplexityScore } from '../../utils/analytics';

interface ComplexityAnalysisChartProps {
  data: ComplexityScore[];
  hideTitle?: boolean;
}

const COMPLEXITY_COLORS = {
  simple: '#A5B1AE',
  moderate: '#C6A27C',
  complex: '#B26F5D'
};

const AXIS_COLOR = '#58606D';
const GRID_COLOR = 'rgba(88, 96, 109, 0.25)';

const LEGEND_ITEMS: Array<{ label: string; level: keyof typeof COMPLEXITY_COLORS }> = [
  { label: 'Simple (<200)', level: 'simple' },
  { label: 'Moderate (200-500)', level: 'moderate' },
  { label: 'Complex (>500)', level: 'complex' }
];

export const ComplexityAnalysisChart: React.FC<ComplexityAnalysisChartProps> = ({ data, hideTitle = false }) => {
  if (!data || data.length === 0) {
    return (
      <div className={hideTitle ? "" : "bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6"}>
        {!hideTitle && (
          <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-4">
            Agent Complexity Analysis
          </h3>
        )}
        <div className="h-96 flex items-center justify-center">
          <p className="text-v-light-text-secondary dark:text-v-text-secondary">No agent data available</p>
        </div>
      </div>
    );
  }

  const chartData = data.map(item => ({
    name: item.agentName,
    score: item.score,
    level: item.level,
    promptLength: item.promptLength,
    toolCount: item.toolCount,
    inheritsAllTools: item.inheritsAllTools
  }));

  return (
    <div className={hideTitle ? "" : "bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6"}>
      {!hideTitle && (
        <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-4">
          Agent Complexity Analysis
        </h3>
      )}
      <div className="mb-4 flex items-center gap-6 text-xs">
        {LEGEND_ITEMS.map(item => (
          <div key={item.level} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COMPLEXITY_COLORS[item.level] }}
            ></span>
            <span className="text-v-light-text-secondary dark:text-v-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 40, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis
              type="number"
              dataKey="score"
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: AXIS_COLOR, opacity: 0.4 }}
              label={{ value: 'Complexity Score', position: 'insideBottom', offset: -10, fill: AXIS_COLOR }}
            />
            <YAxis
              type="number"
              dataKey="promptLength"
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: AXIS_COLOR, opacity: 0.4 }}
              label={{ value: 'Prompt Length (chars)', angle: -90, position: 'insideLeft', fill: AXIS_COLOR }}
            />
            <ZAxis type="number" dataKey="toolCount" range={[60, 260]} name="Tool Count" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              wrapperStyle={{ outline: 'none' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const tooltipData = payload[0].payload;
                return (
                  <div className="min-w-[220px] rounded-lg border border-v-light-border dark:border-white/10 bg-white/95 dark:bg-slate-900/95 text-v-light-text-primary dark:text-v-text-primary shadow-2xl p-4">
                    <div className="font-semibold text-sm mb-3">{tooltipData.name}</div>
                    <div className="text-[11px] space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-v-light-text-secondary dark:text-v-text-secondary">Complexity Score:</span>
                        <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">{tooltipData.score}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-v-light-text-secondary dark:text-v-text-secondary">Prompt Length:</span>
                        <span>{tooltipData.promptLength} chars</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-v-light-text-secondary dark:text-v-text-secondary">Tool Count:</span>
                        <span>
                          {tooltipData.inheritsAllTools ? 'All session tools' : tooltipData.toolCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 pt-2 mt-2 border-t border-v-light-border/70 dark:border-white/10">
                        <span className="text-v-light-text-secondary dark:text-v-text-secondary">Level:</span>
                        <span
                          className="font-semibold capitalize"
                          style={{ color: COMPLEXITY_COLORS[tooltipData.level as keyof typeof COMPLEXITY_COLORS] }}
                        >
                          {tooltipData.level}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter
              data={chartData}
              shape="circle"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COMPLEXITY_COLORS[entry.level]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
