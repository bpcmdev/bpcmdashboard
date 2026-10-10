/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { arr, fmt, fmtMoney, num, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Earned Media: what drove the value. Top outlets and value by product as ranked lists with data bars
 * behind each row, a sort switch (value or placements), a share-of-list figure and a hover highlight.
 * ---------------------------------------------------------------------------------------------- */

const PRESS = 'hsl(226 67% 33%)';
const GOLD = 'hsl(42 64% 45%)';

const tierName = (t: number | null) => (t ? `Tier ${t}` : 'Unrated');
const tierBadge = (t: number | null) => (t === 1 ? 'bg-tier1' : t === 2 ? 'bg-tier2' : t === 3 ? 'bg-tier3' : 'bg-muted text-muted-foreground');

interface Row { key: string; name: string; tier: number | null; count: number; miv: number }

function RankedCard({ title, rows, color, showTier, empty }: { title: string; rows: Row[]; color: string; showTier: boolean; empty: string }) {
  const reduced = usePrefersReducedMotion();
  const [sort, setSort] = useState<'miv' | 'count'>('miv');
  const [hover, setHover] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (sort === 'miv' ? b.miv - a.miv || b.count - a.count : b.count - a.count || b.miv - a.miv)),
    [rows, sort],
  );
  const max = Math.max(...sorted.map(r => (sort === 'miv' ? r.miv : r.count)), 1);
  const totalMiv = rows.reduce((s, r) => s + r.miv, 0);

  return (
    <div className="section-card border p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{title}</h3>
        {rows.length > 1 && (
          <div role="group" aria-label="Sort by" className="flex">
            {([['miv', 'Value'], ['count', 'Placements']] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={sort === m}
                onClick={() => setSort(m)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2',
                  sort === m ? 'bg-foreground text-background border-foreground relative z-10' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">{empty}</p>
      ) : (
        <ul className="space-y-1" onMouseLeave={() => setHover(null)}>
          {sorted.map((r, i) => {
            const v = sort === 'miv' ? r.miv : r.count;
            const on = hover === r.key;
            return (
              <li
                key={r.key}
                className="relative flex items-center gap-3 px-2.5 py-2 text-xs overflow-hidden"
                onMouseEnter={() => setHover(r.key)}
                style={{ background: on ? withAlpha(color, 0.07) : undefined }}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: drawn || reduced ? `${(v / max) * 100}%` : '0%',
                    background: withAlpha(color, on ? 0.2 : 0.12),
                    transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22,1,0.36,1), background 160ms ease',
                  }}
                />
                <span className="relative w-4 text-right text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="relative font-bold flex-1 min-w-0 truncate">{r.name}</span>
                {showTier && (
                  <span className={cn('relative text-[10px] font-bold tracking-wider px-2 py-0.5 shrink-0', tierBadge(r.tier))}>{tierName(r.tier).toUpperCase()}</span>
                )}
                <span className="relative tabular-nums text-muted-foreground w-8 text-right">{fmt(r.count)}</span>
                <span className="relative tabular-nums font-display font-bold w-16 text-right">{fmtMoney(r.miv)}</span>
                <span className="relative tabular-nums text-[10px] text-muted-foreground w-9 text-right hidden sm:block">
                  {totalMiv ? `${Math.round((r.miv / totalMiv) * 100)}%` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-3">Bars show {sort === 'miv' ? 'value' : 'placements'}; the last column is each row&apos;s share of the value listed here.</p>
      )}
    </div>
  );
}

const EarnedMediaDrivers = ({ topOutlets, byProduct }: { topOutlets: any[]; byProduct: any[] }) => {
  const outlets = useMemo<Row[]>(
    () => arr<any>(topOutlets).map((o, i) => ({ key: `${o.outlet}-${i}`, name: String(o.outlet ?? '-'), tier: o.tier == null ? null : num(o.tier), count: num(o.count), miv: num(o.miv) })),
    [topOutlets],
  );
  const products = useMemo<Row[]>(
    () => arr<any>(byProduct).map((p, i) => ({ key: `${p.product}-${i}`, name: String(p.product ?? '-'), tier: null, count: num(p.count), miv: num(p.miv) })),
    [byProduct],
  );

  return (
    <div className={cn('grid gap-4 md:gap-6 items-start', products.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
      <RankedCard title="Top Outlets" rows={outlets} color={PRESS} showTier empty="No outlets in this period." />
      {products.length > 0 && <RankedCard title="MIV by Product" rows={products} color={GOLD} showTier={false} empty="No product-level value in this period." />}
    </div>
  );
};

export default EarnedMediaDrivers;
