import React from 'react';

interface PixelVIconProps extends React.SVGProps<SVGSVGElement> {}

const blocks = [
  { x: 3, y: 2 },
  { x: 17, y: 2 },
  { x: 5, y: 6 },
  { x: 15, y: 6 },
  { x: 7, y: 10 },
  { x: 13, y: 10 },
  { x: 9, y: 14 },
  { x: 11, y: 14 },
];

export const PixelVIcon: React.FC<PixelVIconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    shapeRendering="crispEdges"
    className={className}
    aria-hidden="true"
    {...props}
  >
    {blocks.map((block, index) => (
      <rect key={index} x={block.x} y={block.y} width={4} height={4} rx={0.5} />
    ))}
    <rect x={9} y={18} width={6} height={4} rx={0.5} />
  </svg>
);

export default PixelVIcon;
