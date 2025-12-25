import React from 'react';
import { MCPServerStatus } from '../../types/mcp';

interface StatusIndicatorProps {
  status: MCPServerStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<MCPServerStatus, { color: string; label: string; pulse: boolean }> = {
  unknown: { color: 'bg-gray-400', label: 'Unknown', pulse: false },
  checking: { color: 'bg-blue-400', label: 'Checking...', pulse: true },
  connected: { color: 'bg-green-500', label: 'Connected', pulse: false },
  disconnected: { color: 'bg-red-500', label: 'Disconnected', pulse: false },
  error: { color: 'bg-yellow-500', label: 'Error', pulse: false },
};

const SIZE_CLASSES = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'sm',
  showLabel = false,
  className = '',
}) => {
  const { color, label, pulse } = STATUS_CONFIG[status];

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span
        className={`
          inline-block rounded-full
          ${SIZE_CLASSES[size]}
          ${color}
          ${pulse ? 'animate-pulse' : ''}
        `}
        title={label}
      />
      {showLabel && (
        <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
          {label}
        </span>
      )}
    </div>
  );
};

interface StatusBadgeProps {
  status: MCPServerStatus;
  latencyMs?: number;
  errorMessage?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  latencyMs,
  errorMessage,
  className = '',
}) => {
  const { color, label } = STATUS_CONFIG[status];

  const getBadgeColors = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'disconnected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'error':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'checking':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  const tooltipText = errorMessage
    ? `${label}: ${errorMessage}`
    : latencyMs
      ? `${label} (${latencyMs}ms)`
      : label;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getBadgeColors()} ${className}`}
      title={tooltipText}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
      {latencyMs !== undefined && status === 'connected' && (
        <span className="opacity-75 ml-0.5">{latencyMs}ms</span>
      )}
    </span>
  );
};

export default StatusIndicator;
