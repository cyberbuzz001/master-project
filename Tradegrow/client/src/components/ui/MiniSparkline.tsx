import React from 'react';

export interface MiniSparklineProps {
  changePercent?: number;
  width?: number;
  height?: number;
  className?: string;
  isPositive?: boolean;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  changePercent = 0,
  width = 60,
  height = 22,
  className = '',
  isPositive = changePercent >= 0,
}) => {
  const points = React.useMemo(() => {
    // Generate an organic micro-curve based on change magnitude & direction
    const count = 7;
    const pts: { x: number; y: number }[] = [];
    const step = width / (count - 1);
    const mag = Math.min(Math.max(Math.abs(changePercent), 0.2), 4);
    
    // Seeded curve shape
    const seedDeltas = isPositive
      ? [0.5, 0.4, 0.6, 0.3, 0.7, 0.6, 0.85]
      : [0.5, 0.6, 0.4, 0.7, 0.3, 0.4, 0.15];

    for (let i = 0; i < count; i++) {
      const x = i * step;
      // Invert y because SVG y=0 is at the top
      const normalized = seedDeltas[i];
      const y = height * (1 - normalized);
      pts.push({ x, y });
    }

    return pts;
  }, [changePercent, width, height, isPositive]);

  const pathData = React.useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  const color = isPositive ? 'var(--gain)' : 'var(--loss)';

  return (
    <svg
      width={width}
      height={height}
      className={`overflow-visible flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
};
