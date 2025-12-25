import React, { useState, useEffect, useMemo } from 'react';
import {
  findEnvVarRefs,
  resolveEnvVarRefs,
  isSensitiveVar,
  maskSensitiveValue,
  EnvVarRef,
  EnvVarResolution,
} from '../utils/envVarUtils';
import { getEnvVars } from '../utils/tauriCommands';

interface EnvVarPreviewProps {
  value: string;
  className?: string;
  showPreview?: boolean;
}

/**
 * Component to display environment variable references in a value
 * Shows badges for ${VAR} patterns with tooltips showing resolved values
 */
export const EnvVarPreview: React.FC<EnvVarPreviewProps> = ({
  value,
  className = '',
  showPreview = true,
}) => {
  const [resolutions, setResolutions] = useState<EnvVarResolution[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refs = useMemo(() => findEnvVarRefs(value), [value]);

  useEffect(() => {
    if (refs.length === 0) {
      setResolutions([]);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    const fetchEnvVars = async () => {
      try {
        const varNames = [...new Set(refs.map(r => r.varName))];
        const envValues = await getEnvVars(varNames);

        if (isCancelled) return;

        // Convert null to undefined for type compatibility
        const envVars: Record<string, string | undefined> = {};
        for (const [key, val] of Object.entries(envValues)) {
          envVars[key] = val ?? undefined;
        }

        const resolved = resolveEnvVarRefs(refs, envVars);
        setResolutions(resolved);
      } catch (error) {
        console.error('Failed to fetch env vars:', error);
        // Set all as unresolved on error
        setResolutions(
          refs.map(ref => ({
            ref,
            resolvedValue: undefined,
            source: 'unresolved' as const,
          }))
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchEnvVars();

    return () => {
      isCancelled = true;
    };
  }, [refs]);

  if (refs.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 mt-2 ${className}`}>
      {isLoading ? (
        <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
          Loading environment variables...
        </span>
      ) : (
        resolutions.map((resolution, index) => (
          <EnvVarBadge key={index} resolution={resolution} showPreview={showPreview} />
        ))
      )}
    </div>
  );
};

interface EnvVarBadgeProps {
  resolution: EnvVarResolution;
  showPreview: boolean;
}

const EnvVarBadge: React.FC<EnvVarBadgeProps> = ({ resolution, showPreview }) => {
  const { ref, resolvedValue, source } = resolution;
  const [showTooltip, setShowTooltip] = useState(false);

  const isSensitive = isSensitiveVar(ref.varName);
  const displayValue = resolvedValue
    ? isSensitive
      ? maskSensitiveValue(resolvedValue)
      : resolvedValue
    : undefined;

  const getBadgeColors = () => {
    switch (source) {
      case 'environment':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'default':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'unresolved':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  const getTooltipText = () => {
    switch (source) {
      case 'environment':
        return `From environment: ${displayValue}`;
      case 'default':
        return `Using default: ${displayValue}`;
      case 'unresolved':
        return 'Not set in environment' + (ref.defaultValue ? '' : ' (no default)');
    }
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono border ${getBadgeColors()}`}
      >
        <span className="opacity-60 mr-0.5">$</span>
        {ref.varName}
        {source === 'unresolved' && (
          <svg
            className="ml-1 h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
      </span>

      {/* Tooltip */}
      {showTooltip && showPreview && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-v-light-surface dark:bg-v-dark border border-v-light-border dark:border-v-border shadow-lg z-50 whitespace-nowrap">
          <p className="text-xs text-v-light-text-primary dark:text-v-text-primary">
            {getTooltipText()}
          </p>
          {source === 'environment' && isSensitive && (
            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-0.5">
              (Value partially hidden for security)
            </p>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-v-light-border dark:border-t-v-border" />
            <div className="absolute top-0 left-0 border-4 border-transparent border-t-v-light-surface dark:border-t-v-dark -mt-px" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Inline indicator for fields that use environment variables
 */
export const EnvVarIndicator: React.FC<{ value: string }> = ({ value }) => {
  const refs = useMemo(() => findEnvVarRefs(value), [value]);

  if (refs.length === 0) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center ml-1.5 text-blue-500 dark:text-blue-400"
      title={`Uses ${refs.length} environment variable${refs.length > 1 ? 's' : ''}`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
        />
      </svg>
    </span>
  );
};

export default EnvVarPreview;
