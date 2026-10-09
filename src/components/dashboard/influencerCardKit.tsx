/* eslint-disable @typescript-eslint/no-explicit-any -- the ring colour is passed as a CSS custom property */
/* eslint-disable react-refresh/only-export-components -- shared helpers and small components for the influencer cards */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------------------------------
 * Shared building blocks for the Influencer Intelligence cards: colour helpers, count-up, the
 * click-to-open metric card, the detail panel shell and insight chips.
 * ---------------------------------------------------------------------------------------------- */

/** Adds an alpha channel to hex, hsl() or rgb() colours (client accent colours are usually hex). */
export function withAlpha(color: string, a: number): string {
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16);
    if (h.length !== 6 || Number.isNaN(n)) return c;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  if (c.startsWith('hsl(') && !c.includes('/')) return c.replace(/\)$/, ` / ${a})`);
  if (c.startsWith('rgb(')) return c.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `, ${a})`);
  return c;
}

export const hsl = (h: number, s = 72, l = 42) => `hsl(${h} ${s}% ${l}%)`;

export const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Full number below 10,000 (so 1,603 stays 1,603), compact above. */
export function fmt(n: number): string {
  const v = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e9) return `${sign}${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${sign}${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${sign}${Math.round(v / 1e3)}K`;
  return `${sign}${Math.round(v).toLocaleString('en-US')}`;
}
export const fmtMoney = (n: number) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n))}`;
export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function useCountUp(target: number, ms = 800): number {
  const reduced = usePrefersReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return v;
}

/** Number of grid columns at the current width, matching Tailwind's md (768) and lg (1024) breakpoints. */
export function useColumns(rules: { base: number; md?: number; lg?: number }): number {
  const [width, setWidth] = useState(1400);
  useEffect(() => {
    const calc = () => setWidth(window.innerWidth);
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  if (width >= 1024 && rules.lg) return rules.lg;
  if (width >= 768 && rules.md) return rules.md;
  return rules.base;
}

/** Index of the card after which the detail panel should render, so it opens under the clicked card's row. */
export function insertAfterIndex(selectedIdx: number, cols: number, count: number): number {
  if (selectedIdx < 0) return -1;
  return Math.min(count - 1, (Math.floor(selectedIdx / cols) + 1) * cols - 1);
}

export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

/** Up/down chip. `pct` is a percentage change; `invert` flips good and bad (for example churn). */
export function DeltaChip({ pct, invert = false, suffix = '%', title }: { pct: number | null | undefined; invert?: boolean; suffix?: string; title?: string }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (Math.abs(pct) < 0.05) return <span className="font-mono-ui text-[10px] text-muted-foreground" title={title}>Stable</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span
      title={title}
      className={cn('font-mono-ui text-[10px] tracking-[0.06em] px-1.5 py-0.5 tabular-nums', good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}{suffix === '%' ? '%' : ` ${suffix}`}
    </span>
  );
}

export interface MetricCardProps {
  color: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  controls?: string;
  delta?: ReactNode;
  children: ReactNode;
}

/** Colour-edged card that opens a detail panel on click. */
export function MetricCard({ color, icon: Icon, label, active, onClick, controls, delta, children }: MetricCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-expanded={active}
      aria-controls={active ? controls : undefined}
      onClick={onClick}
      className={cn(
        'group relative w-full min-w-0 text-left border border-black/10 bg-card p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'hover:-translate-y-0.5 hover:shadow-md',
        active && '-translate-y-0.5 shadow-md',
      )}
      style={{
        borderTop: `3px solid ${color}`,
        borderLeftColor: active ? withAlpha(color, 0.5) : undefined,
        borderRightColor: active ? withAlpha(color, 0.5) : undefined,
        borderBottomColor: active ? withAlpha(color, 0.5) : undefined,
        background: active
          ? `linear-gradient(165deg, ${withAlpha(color, 0.14)}, ${withAlpha(color, 0.03)})`
          : `linear-gradient(165deg, ${withAlpha(color, 0.06)}, transparent 70%)`,
        boxShadow: active ? `0 6px 18px -8px ${withAlpha(color, 0.55)}` : undefined,
        ['--tw-ring-color' as any]: color,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0" style={{ color }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: withAlpha(color, 0.14) }}>
            <Icon className="w-3.5 h-3.5" aria-hidden />
          </span>
          <span className="font-mono-ui text-[10px] tracking-[0.16em] uppercase truncate">{label}</span>
        </span>
        {delta}
      </div>
      {children}
      <p className="font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground mt-2 opacity-70 group-hover:opacity-100 transition-opacity">
        {active ? 'Click to close' : 'Click for details'}
      </p>
    </button>
  );
}

/** Animated number for a card, formatted by the caller. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}

export function DetailShell({ id, color, icon: Icon, label, value, sub, blurb, onClose, children }: {
  id: string; color: string; icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode; blurb?: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label={`${label} details`}
      className="col-span-full border animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        borderLeftColor: withAlpha(color, 0.35),
        borderRightColor: withAlpha(color, 0.35),
        borderBottomColor: withAlpha(color, 0.35),
        borderTop: `3px solid ${color}`,
        background: `linear-gradient(180deg, ${withAlpha(color, 0.07)}, transparent 60%)`,
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: withAlpha(color, 0.14), color }}>
              <Icon className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-mono-ui text-[10px] tracking-[0.16em] uppercase" style={{ color }}>{label}</p>
              <p className="font-display text-3xl font-bold tabular-nums leading-tight">
                {value}
                {sub && <span className="ml-3 align-middle text-base font-normal text-muted-foreground font-sans">{sub}</span>}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 shrink-0">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        {blurb && <p className="text-sm text-muted-foreground mt-3 max-w-3xl">{blurb}</p>}
        {children}
      </div>
    </div>
  );
}

export function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <p className="font-mono-ui text-[9px] tracking-[0.16em] uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export function SubLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono-ui text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-2">{children}</p>;
}

export function Chips({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {items.map(t => (
        <li key={t} className="text-xs px-3 py-1.5" style={{ background: withAlpha(color, 0.1), color: 'hsl(0 0% 20%)' }}>{t}</li>
      ))}
    </ul>
  );
}

/** Dark tooltip with readable text, for recharts. */
export const tooltipStyle = {
  contentStyle: { backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, fontSize: 11 },
  labelStyle: { color: 'white' },
  itemStyle: { color: 'white' },
} as const;

export const axisTick = { fontSize: 10, fill: 'hsl(0 0% 45%)' } as const;
