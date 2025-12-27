import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-skeleton-shimmer bg-gradient-to-r from-v-light-border via-v-light-hover to-v-light-border dark:from-v-border dark:via-v-light-dark dark:to-v-border bg-[length:200%_100%] rounded ${className}`}
      aria-hidden="true"
    />
  );
};

interface SkeletonTextProps {
  width?: string;
  className?: string;
}

/**
 * Single line text skeleton
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  width = 'w-3/4',
  className = ''
}) => {
  return <Skeleton className={`h-4 ${width} ${className}`} />;
};

interface SkeletonCardProps {
  className?: string;
}

/**
 * Card skeleton matching AgentGridCard dimensions
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-v-light-surface dark:bg-v-mid-dark/90 p-4 ${className}`}
      aria-hidden="true"
    >
      {/* Header row: checkbox + name + favorite */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-1 h-4 w-4 rounded" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-1 w-1 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Description */}
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      {/* Tags */}
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Path */}
      <Skeleton className="mt-3 h-3 w-2/3" />

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-dashed border-v-light-border/80 dark:border-v-border flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  );
};

interface SkeletonListItemProps {
  gridTemplateColumns?: string;
  className?: string;
}

/**
 * List item skeleton matching AgentListItem dimensions
 */
export const SkeletonListItem: React.FC<SkeletonListItemProps> = ({
  gridTemplateColumns,
  className = ''
}) => {
  return (
    <div
      className={`grid gap-4 items-center px-4 py-3 bg-v-light-surface dark:bg-v-mid-dark ${className}`}
      style={gridTemplateColumns ? { gridTemplateColumns } : { gridTemplateColumns: '40px 2fr 1.5fr 80px 1fr 1fr 140px' }}
      aria-hidden="true"
    >
      {/* Checkbox */}
      <div className="flex justify-center">
        <Skeleton className="h-4 w-4 rounded" />
      </div>

      {/* Name & description */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>

      {/* Path */}
      <Skeleton className="h-3 w-full" />

      {/* Scope badge */}
      <Skeleton className="h-5 w-16 rounded" />

      {/* Model */}
      <Skeleton className="h-4 w-20" />

      {/* Tools */}
      <Skeleton className="h-4 w-16" />

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  );
};

interface SkeletonListProps {
  count?: number;
  variant?: 'card' | 'list';
  gridTemplateColumns?: string;
  className?: string;
}

/**
 * Renders multiple skeleton items for loading states
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  variant = 'list',
  gridTemplateColumns,
  className = ''
}) => {
  return (
    <div className={className} aria-label="Loading content" role="status">
      {variant === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: count }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-v-light-border dark:divide-v-border">
          {Array.from({ length: count }).map((_, index) => (
            <SkeletonListItem key={index} gridTemplateColumns={gridTemplateColumns} />
          ))}
        </div>
      )}
    </div>
  );
};
