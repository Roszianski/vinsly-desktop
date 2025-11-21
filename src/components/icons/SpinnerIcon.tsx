import React from 'react';

interface SpinnerIconProps {
  className?: string;
}

export const SpinnerIcon: React.FC<SpinnerIconProps> = ({
  className = 'h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary'
}) => (
  <svg
    className={`animate-spin ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="9" />
    <path className="opacity-75" d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);
