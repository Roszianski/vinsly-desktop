import React from 'react';

interface CloseIconProps extends React.SVGProps<SVGSVGElement> {}

export const CloseIcon: React.FC<CloseIconProps> = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M5 5l10 10M15 5l-10 10"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
