import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  /** Progress value between 0 and 100 */
  value: number;
  /** Optional label to display */
  label?: string;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Indeterminate mode (unknown progress) */
  indeterminate?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3'
};

const colorClasses = {
  default: 'bg-v-accent',
  success: 'bg-v-success',
  warning: 'bg-v-warning',
  danger: 'bg-v-danger'
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  showPercentage = false,
  size = 'md',
  variant = 'default',
  indeterminate = false,
  className = ''
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`} role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={100}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
              {label}
            </span>
          )}
          {showPercentage && !indeterminate && (
            <span className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full rounded-full bg-v-light-border dark:bg-v-border overflow-hidden ${sizeClasses[size]}`}>
        {indeterminate ? (
          <motion.div
            className={`h-full ${colorClasses[variant]} rounded-full`}
            initial={{ x: '-100%', width: '30%' }}
            animate={{ x: '400%' }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: 'easeInOut'
            }}
          />
        ) : (
          <motion.div
            className={`h-full ${colorClasses[variant]} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  );
};

interface ProgressOverlayProps {
  /** Whether the overlay is visible */
  isVisible: boolean;
  /** Progress value (0-100), or undefined for indeterminate */
  progress?: number;
  /** Message to display */
  message?: string;
  /** Sub-message for additional context */
  subMessage?: string;
}

/**
 * Full-screen progress overlay for long operations
 */
export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  isVisible,
  progress,
  message = 'Processing...',
  subMessage
}) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-v-light-surface dark:bg-v-mid-dark rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
            {message}
          </p>
          {subMessage && (
            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
              {subMessage}
            </p>
          )}
        </div>
        <ProgressBar
          value={progress ?? 0}
          indeterminate={progress === undefined}
          showPercentage={progress !== undefined}
          size="md"
        />
      </div>
    </motion.div>
  );
};
