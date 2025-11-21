import React from 'react';

interface CheckIconProps extends React.SVGProps<SVGSVGElement> {}

export const CheckIcon: React.FC<CheckIconProps> = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M5 10.5l3 3 7-7"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
