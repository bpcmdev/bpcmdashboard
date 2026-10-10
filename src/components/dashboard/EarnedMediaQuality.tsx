/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Chips, SubLabel, arr, fmt, fmtMoney, num, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Earned Media: coverage quality.
 * Shows how placements and value split across outlet tiers, side by side, so it is obvious which tier
 * carries the weight. Hover or select a tier to light it up in both bars. Online vs print can be viewed
 * by placements or by value.
 * ---------------------------------------------------------------------------------------------- */

const TIER_COLOR: Record<number, string> = {
  1: 'hsl(226 67% 33%)',
  2: 'hsl(42 64% 45%)',
  3: 'hsl(0 0% 60%)',
  0: 'hsl(0 0% 82%)',
};
const TIER_ORDER = [1, 2, 3, 0];
const PRESS = 'hsl(226 67% 33%)';

const tierName = (t: number) => (t ? `Tier ${t}` : 'Unrated');
const tierBadge = (t: number) => (t === 1 ? 'bg-tier1' : t === 2 ? 'bg-tier2' : t === 3 ? 'bg-tier3' : 'bg-muted text-muted-foreground');

interface Props {
  tierMix: any[];
  pressChannelMix: any[];
}

const EarnedMediaQuality = ({ tierMix, pressChannelMix }: Props) => {
  const reduced = usePrefersReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [metric, setMetric] = useState<'count' | 'miv'>('count');
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const tiers = useMemo(
    () => arr<any>(tierMix)
      .map(r => ({ tier: num(r.tier), count: num(r.count), miv: num(r.miv) }))
      .filter(r => r.count > 0 || r.miv > 0)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)),
    [tierMix],
  );
  const channels = useMemo(
    () => arr<any>(pressChannelMix).map(r => {
      const c = String(r.channel_type ?? r.channel ?? '').toLowerCase();
      const label = c.includes('print') ? 'Print' : c.includes('online') || c.includes('web') || c.includes('digital') ? 'Online' : c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Unspecified';
      return { label, count: num(r.count), miv: num(r.miv) };
    }),
    [pressChannelMix],
  );

  const totalCount = tiers.reduce((s, r) => s + r.count, 0);
  const totalMiv = tiers.reduce((s, r) => s + r.miv, 0);
  const avgAll = totalCount ? totalMiv / totalCount : 0;
  const active = hover ?? selected;
  const activeRow = active != null ? tiers.find(r => r.tier === active) ?? null : null;

  const insights = useMemo(() => {
    const out: string[] = [];
    if (!totalCount || !totalMiv) return out;
    const top = tiers.filter(r => r.tier === 1 || r.tier === 2);
    const topCount = top.reduce((s, r) => s + r.count, 0);
    const topMiv = top.reduce((s, r) => s + r.miv, 0);
    if (topCount > 0) out.push(`Tier 1 and 2 outlets are ${Math.round((topCount / totalCount) * 100)}% of placements and ${Math.round((topMiv / totalMiv) * 100)}% of value.`);
    const best = tiers.filter(r => r.tier > 0 && r.count > 0).sort((a, b) => b.miv / b.count - a.miv / a.count)[0];
    if (best && avgAll > 0) out.push(`${tierName(best.tier)} placements are the most valuable: ${fmtMoney(best.miv / best.count)} each, ${(best.miv / best.count / avgAll).toFixed(1)}x the average.`);
    const unrated = tiers.find(r => r.tier === 0);
    if (unrated && unrated.count > 0) out.push(`${unrated.count} placements are still unrated, so the quality picture may improve as outlets are tiered.`);
    const online = channels.find(c => c.label === 'Online');
    const print = channels.find(c => c.label === 'Print');
    if (online && print && online.count > 0 && print.count > 0) {
      const o = online.miv / online.count;
      const p = print.miv / print.count;
      if (o > 0 && p > 0 && Math.max(o, p) / Math.min(o, p) >= 1.3) out.push(`A print placement is worth ${fmtMoney(p)} against ${fmtMoney(o)} online.`);
    }
    return out.slice(0, 4);
  }, [tiers, channels, totalCount, totalMiv, avgAll]);

  if (tiers.length === 0) {
    return (
      <div className="section-card border p-5 md:p-6">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Coverage Quality</h3>
        <p className="text-xs text-muted-foreground py-4">No tiered placements in this period.</p>
      </div>
    );
  }

  const channelMax = Math.max(...channels.map(c => (metric === 'count' ? c.count : c.miv)), 1);
  const channelTotal = channels.reduce((s, c) => s + (metric === 'count' ? c.count : c.miv), 0);

  const renderStack = (label: string, field: 'count' | 'miv', total: number) => (
    <div>
      <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1.5">{label}</p>
      <div className="flex h-7 w-full overflow-hidden bg-muted" onMouseLeave={() => setHover(null)}>
        {tiers.map(r => {
          const share = total ? (r[field] / total) * 100 : 0;
          if (share <= 0) return null;
          const dim = active != null && active !== r.tier;
          return (
            <button
              key={r.tier}
              type="button"
              aria-label={`${tierName(r.tier)}: ${share.toFixed(1)}% of ${field === 'count' ? 'placements' : 'value'}`}
              onMouseEnter={() => setHover(r.tier)}
              onFocus={() => setHover(r.tier)}
              onBlur={() => setHover(null)}
              onClick={() => setSelected(prev => (prev === r.tier ? null : r.tier))}
              className="h-full flex items-center justify-center text-[10px] font-bold overflow-hidden whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              style={{
                width: drawn || reduced ? `${share}%` : '0%',
                minWidth: drawn && share > 0 ? 3 : 0,
                background: TIER_COLOR[r.tier],
                color: r.tier === 0 ? 'hsl(0 0% 30%)' : 'white',
                opacity: dim ? 0.3 : 1,
                transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22,1,0.36,1), opacity 160ms ease',
              }}
            >
              {share >= 9 ? `${Math.round(share)}%` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="section-card border p-5 md:p-6"
      style={{ background: `linear-gradient(160deg, ${withAlpha(PRESS, 0.05)}, transparent 55%)` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Coverage Quality</h3>
        <p className="text-[11px] text-muted-foreground">Hover or select a tier to compare</p>
      </div>

      <div className="space-y-3">
        {renderStack('Share of placements', 'count', totalCount)}
        {renderStack('Share of value', 'miv', totalMiv)}
      </div>

      <p className="text-xs mt-3 min-h-[2.25rem]" aria-live="polite">
        {activeRow ? (
          <>
            <span className="font-bold" style={{ color: TIER_COLOR[activeRow.tier] === TIER_COLOR[0] ? 'hsl(0 0% 35%)' : TIER_COLOR[activeRow.tier] }}>{tierName(activeRow.tier)}</span>
            {`: ${totalCount ? ((activeRow.count / totalCount) * 100).toFixed(1) : 0}% of placements, ${totalMiv ? ((activeRow.miv / totalMiv) * 100).toFixed(1) : 0}% of value`}
            {activeRow.count > 0 ? `, ${fmtMoney(activeRow.miv / activeRow.count)} per placement` : ''}
            {activeRow.count > 0 && avgAll > 0 ? ` (${(activeRow.miv / activeRow.count / avgAll).toFixed(1)}x the average).` : '.'}
          </>
        ) : (
          <span className="text-muted-foreground">Tiers rank outlets by influence. Fewer high-tier placements usually carry far more value each.</span>
        )}
      </p>

      <div className="mt-4 divide-y divide-border">
        <div className="grid grid-cols-12 gap-2 pb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
          <span className="col-span-4">Tier</span>
          <span className="col-span-2 text-right">Placements</span>
          <span className="col-span-2 text-right">Value</span>
          <span className="col-span-2 text-right">Each</span>
          <span className="col-span-2 text-right">vs avg</span>
        </div>
        {tiers.map(r => {
          const each = r.count ? r.miv / r.count : 0;
          const mult = avgAll > 0 && each > 0 ? each / avgAll : 0;
          const on = active === r.tier;
          return (
            <button
              key={r.tier}
              type="button"
              aria-pressed={selected === r.tier}
              onMouseEnter={() => setHover(r.tier)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r.tier)}
              onBlur={() => setHover(null)}
              onClick={() => setSelected(prev => (prev === r.tier ? null : r.tier))}
              className="w-full grid grid-cols-12 gap-2 py-2.5 px-1 items-center text-xs text-left transition-colors focus:outline-none focus-visible:ring-2"
              style={{ background: on ? withAlpha(TIER_COLOR[r.tier], 0.1) : undefined, boxShadow: selected === r.tier ? `inset 3px 0 0 ${TIER_COLOR[r.tier]}` : undefined }}
            >
              <span className="col-span-4">
                <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5', tierBadge(r.tier))}>{tierName(r.tier).toUpperCase()}</span>
              </span>
              <span className="col-span-2 text-right tabular-nums">{fmt(r.count)}</span>
              <span className="col-span-2 text-right tabular-nums font-display font-bold">{fmtMoney(r.miv)}</span>
              <span className="col-span-2 text-right tabular-nums text-muted-foreground">{each ? fmtMoney(each) : '-'}</span>
              <span className="col-span-2 text-right">
                {mult ? (
                  <span
                    className="inline-block text-[10px] font-bold tabular-nums px-1.5 py-0.5"
                    style={{ background: mult >= 1 ? withAlpha('hsl(152 55% 38%)', 0.14) : 'hsl(0 0% 94%)', color: mult >= 1 ? 'hsl(152 55% 28%)' : 'hsl(0 0% 40%)' }}
                  >
                    {mult.toFixed(1)}x
                  </span>
                ) : <span className="text-muted-foreground">-</span>}
              </span>
            </button>
          );
        })}
      </div>

      {channels.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <SubLabel>Online vs print</SubLabel>
            <div role="group" aria-label="Show by" className="flex">
              {([['count', 'Placements'], ['miv', 'Value']] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metric === m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    'px-3 py-1 text-[11px] font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2',
                    metric === m ? 'bg-foreground text-background border-foreground relative z-10' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="space-y-2.5">
            {channels.map(c => {
              const v = metric === 'count' ? c.count : c.miv;
              const each = c.count ? c.miv / c.count : 0;
              return (
                <li key={c.label}>
                  <div className="flex items-baseline justify-between text-xs mb-1 gap-2">
                    <span className="font-semibold">{c.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {metric === 'count' ? fmt(c.count) : fmtMoney(c.miv)}
                      {channelTotal ? <span className="font-semibold text-foreground"> {Math.round((v / channelTotal) * 100)}%</span> : null}
                      {each > 0 ? <span> · {fmtMoney(each)} each</span> : null}
                    </span>
                  </div>
                  <div className="h-2 bg-black/[0.06]">
                    <div className="h-full" style={{ width: `${(v / channelMax) * 100}%`, background: PRESS, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Chips items={insights} color={PRESS} />
    </div>
  );
};

export default EarnedMediaQuality;
