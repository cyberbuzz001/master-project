import { useState, useEffect, useRef } from 'react';

export type TickDirection = 'up' | 'down' | null;

export function useLiveTickFlash(
  value: number | string | undefined | null,
  durationMs = 350
): { direction: TickDirection; flashClass: string } {
  const [direction, setDirection] = useState<TickDirection>(null);
  const prevValRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === undefined || value === null) return;
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return;

    if (prevValRef.current !== null && prevValRef.current !== num) {
      const dir: TickDirection = num > prevValRef.current ? 'up' : 'down';
      setDirection(dir);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setDirection(null);
      }, durationMs);
    }

    prevValRef.current = num;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, durationMs]);

  const flashClass =
    direction === 'up'
      ? 'animate-tick-up'
      : direction === 'down'
      ? 'animate-tick-down'
      : '';

  return { direction, flashClass };
}
