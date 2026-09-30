import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'rounded';
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rounded',
  width,
  height,
  style,
}) => {
  const radiusClass =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'rectangular'
      ? 'rounded-none'
      : 'rounded-lg';

  return (
    <div
      className={`skeleton-shimmer ${radiusClass} ${className}`}
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export const CardSkeleton: React.FC<{ className?: string; rows?: number }> = ({
  className = '',
  rows = 3,
}) => {
  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton width="40%" height={16} />
        <Skeleton width={24} height={24} variant="circular" />
      </div>
      <Skeleton width="70%" height={28} />
      {rows > 1 && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-light)]">
          {Array.from({ length: rows - 1 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton width="30%" height={12} />
              <Skeleton width="25%" height={12} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const StatTileSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col justify-between ${className}`}
    >
      <Skeleton width="35%" height={12} className="mb-2" />
      <Skeleton width="60%" height={24} className="mb-2" />
      <Skeleton width="45%" height={12} />
    </div>
  );
};

export const TableRowSkeleton: React.FC<{
  columns?: number;
  className?: string;
  rowHeight?: number;
}> = ({ columns = 5, className = '', rowHeight = 44 }) => {
  return (
    <div
      className={`flex items-center gap-4 px-4 border-b border-[var(--border-color)] ${className}`}
      style={{ height: `${rowHeight}px` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="flex-1"
          style={{ flex: i === 0 ? 1.5 : 1 }}
        >
          <Skeleton
            width={i === 0 ? '75%' : i % 2 === 0 ? '55%' : '40%'}
            height={14}
          />
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}> = ({ rows = 5, columns = 5, showHeader = true, className = '' }) => {
  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden ${className}`}
    >
      {showHeader && (
        <div className="flex items-center gap-4 px-4 py-3 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)]">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1" style={{ flex: i === 0 ? 1.5 : 1 }}>
              <Skeleton width="50%" height={12} />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
};

export const WatchlistSkeleton: React.FC<{ items?: number; className?: string }> = ({
  items = 6,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl"
        >
          <div className="space-y-1.5 flex-1">
            <Skeleton width="40%" height={14} />
            <Skeleton width="25%" height={10} />
          </div>
          <div className="w-20 hidden sm:block">
            <Skeleton width="100%" height={18} />
          </div>
          <div className="space-y-1.5 text-right flex flex-col items-end flex-1">
            <Skeleton width="50%" height={14} />
            <Skeleton width="30%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const OptionChainSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 10,
  className = '',
}) => {
  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden ${className}`}>
      <div className="grid grid-cols-11 gap-2 p-3 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-color)]">
        {Array.from({ length: 11 }).map((_, i) => (
          <Skeleton key={i} width="70%" height={12} className="mx-auto" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`grid grid-cols-11 gap-2 p-3 border-b border-[var(--border-color)] ${
            i === Math.floor(rows / 2) ? 'bg-amber-500/10' : ''
          }`}
        >
          {Array.from({ length: 11 }).map((_, j) => (
            <Skeleton
              key={j}
              width={j === 5 ? '80%' : '60%'}
              height={14}
              className={`mx-auto ${j === 5 ? 'bg-amber-500/30' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
