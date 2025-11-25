import React from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, trend }) => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <div className="h-full bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-6 shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 hover:border-v-accent/30">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-v-light-text-secondary dark:text-v-text-secondary uppercase tracking-wider">
              {title}
            </p>
            <p className="mt-2 text-3xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trend.value >= 0 ? '+' : ''}{trend.value}%
                </span>
                <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                  {trend.label}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 ml-4 p-3 bg-v-accent/10 rounded-lg">
              <div className="text-v-accent">
                {icon}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
