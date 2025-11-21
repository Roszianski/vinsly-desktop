import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ToolCategoryBreakdown } from '../../utils/analytics';

interface ToolsBreakdownChartProps {
  data: ToolCategoryBreakdown[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Read-only': '#C17356',
  'Edit': '#B8684F',
  'Execution': '#8F564F',
  'Other': '#58606D',
  'All Tools': '#7A4D4A'
};

const AXIS_COLOR = '#58606D';
const GRID_COLOR = 'rgba(88, 96, 109, 0.25)';
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(247, 247, 245, 0.95)',
  border: '1px solid rgba(88, 96, 109, 0.25)',
  borderRadius: '12px',
  color: '#1F2933',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
  padding: '10px 14px'
};

export const ToolsBreakdownChart: React.FC<ToolsBreakdownChartProps> = ({ data }) => {
  const chartData = data.map(item => ({
    category: item.category,
    count: item.count,
    percentage: item.percentage
  }));

  return (
    <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-4">
        Tool Permission Breakdown
      </h3>
      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-4">
        Distribution of tool categories across all agents
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis
              dataKey="category"
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: AXIS_COLOR, opacity: 0.4 }}
            />
            <YAxis
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: AXIS_COLOR, opacity: 0.4 }}
              label={{ value: 'Usage Count', angle: -90, position: 'insideLeft', fill: AXIS_COLOR }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'var(--tool-breakdown-cursor, rgba(240, 240, 238, 0.65))' }}
              formatter={(value: number, name: string, props: any) => [
                `${value} uses (${props.payload.percentage}%)`,
                'Count'
              ]}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS['Other']} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
