import React from 'react';

interface NetworkIconProps {
  className?: string;
}

export const NetworkIcon: React.FC<NetworkIconProps> = ({ className = 'h-5 w-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="5" r="3" />
    <circle cx="5" cy="19" r="3" />
    <circle cx="19" cy="19" r="3" />
    <path d="M12 8v4.5" />
    <path d="M7.5 17l4.5-2.7" />
    <path d="M16.5 17l-4.5-2.7" />
  </svg>
);
