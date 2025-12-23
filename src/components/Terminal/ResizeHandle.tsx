import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  onResize: (deltaY: number) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastYRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    lastYRef.current = e.clientY;
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = lastYRef.current - e.clientY;
      lastYRef.current = e.clientY;
      onResize(deltaY);
    },
    [isDragging, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize
        flex items-center justify-center
        transition-colors duration-150
        ${isDragging ? 'bg-v-accent' : 'hover:bg-v-accent/50'}
      `}
    >
      <div className="w-12 h-0.5 rounded-full bg-v-text-secondary/30" />
    </div>
  );
};
