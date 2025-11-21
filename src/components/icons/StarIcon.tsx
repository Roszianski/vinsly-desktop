import React from 'react';

interface StarIconProps {
  className?: string;
  filled?: boolean;
}

export const StarIcon: React.FC<StarIconProps> = ({ className = 'h-4 w-4', filled = false }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3.5l2.7 5.48 6.06.88-4.38 4.32 1.03 6-5.41-2.85L6.59 20.2l1.03-6-4.38-4.32 6.06-.88L12 3.5z" />
  </svg>
);
