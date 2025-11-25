import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ModelDistribution } from '../../utils/analytics';

interface ModelDistributionChartProps {
  data: ModelDistribution[];
  title?: string;
  itemLabel?: string;
}

const MODEL_COLORS: Record<string, string> = {
  Sonnet: '#C17356',
  Haiku: '#B8684F',
  Opus: '#A35F55',
  Inherit: '#8F564F',
  Default: '#58606D'
};

const tooltipStyle = {
  backgroundColor: 'rgba(247, 247, 245, 0.95)',
  border: '1px solid rgba(88, 96, 109, 0.25)',
  borderRadius: '12px',
  color: '#1F2933',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
  padding: '10px 14px'
};

export const ModelDistributionChart: React.FC<ModelDistributionChartProps> = ({
  data,
  title = 'Model Distribution',
  itemLabel = 'agents'
}) => {
  const chartData = useMemo(
    () =>
      data.map(item => ({
        name: item.model,
        value: item.count
      })),
    [data]
  );

  const renderCustomLabel = ({ percent }: { percent?: number }) => {
    if (percent === undefined) return '';
    return `${Math.round(percent * 100)}%`;
  };

  return (
    <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-4">
        {title}
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={MODEL_COLORS[entry.name] || MODEL_COLORS.Default}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [`${value} ${itemLabel}`, name]}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
