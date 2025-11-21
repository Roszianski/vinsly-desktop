import React from 'react';
import { ToolRisk } from '../../types';

interface RiskBadgeProps {
  risk: ToolRisk;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  const riskColor = {
    [ToolRisk.Low]: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
    [ToolRisk.Medium]: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
    [ToolRisk.High]: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
    [ToolRisk.Unknown]: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  };

  return <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${riskColor[risk]}`}>{risk}</span>;
};
