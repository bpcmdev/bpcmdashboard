import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `value` on first render and whenever the value
 * changes. Honors prefers-reduced-motion by jumping straight to the value.
 */
export function useCountUp(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}

interface CountUpProps {
  value: number;
  duration?: number;
  /** Formats the in-flight value; defaults to a rounded integer with separators. */
  format?: (v: number) => string;
  className?: string;
}

const CountUp = ({ value, duration = 600, format, className }: CountUpProps) => {
  const current = useCountUp(value, duration);
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString());
  return <span className={className}>{fmt(current)}</span>;
};

export default CountUp;
