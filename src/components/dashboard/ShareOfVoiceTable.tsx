import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek, applyWeekStartFilter } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { DeltaChip, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

interface SovRow {
  rank: number;
  brand: string;
  pct: number;
  deltaPts: number;
  highlight: boolean;
}

const OWN = 'hsl(225 70% 35%)';
const OTHER = 'hsl(0 0% 0% / 0.2)';

const ShareOfVoiceTable = () => {
  const [sovData, setSovData] = useState<SovRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { clientName } = useAdmin();
  const { selectedWeek, refreshKey, activeClientId, rangeMode, rangeFrom, rangeTo, weekFilterCtx } = useWeek();

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!activeClientId) return;
    if (rangeMode === 'week' && !selectedWeek) return;
    if (rangeMode === 'range' && (!rangeFrom || !rangeTo)) return;

    const fetchSov = async () => {
      setLoading(true);
      setError(false);

      let query = supabase
        .from('competitive_sov')
        .select('brand_name, sov_pct, delta_pts')
        .eq('client_id', activeClientId);
      query = applyWeekStartFilter(query, weekFilterCtx);

      const { data, error: err } = await query;

      if (err) {
        console.error('Failed to fetch competitive_sov:', err);
        setError(true);
        setLoading(false);
        return;
      }

      // Aggregate across platforms (and weeks if range): average sov_pct and delta_pts per brand
      const brandMap = new Map<string, { totalPct: number; totalDelta: number; count: number }>();
      (data ?? []).forEach((row: any) => {
        const brand = row.brand_name ?? '';
        const entry = brandMap.get(brand) || { totalPct: 0, totalDelta: 0, count: 0 };
        entry.totalPct += row.sov_pct ?? 0;
        entry.totalDelta += row.delta_pts ?? 0;
        entry.count += 1;
        brandMap.set(brand, entry);
      });

      // The client's own brand is matched by name; before the name loads, fall back to the original Milk match.
      const ownName = (clientName ?? '').trim().toLowerCase();
      const ownWord = ownName.split(/\s+/)[0] ?? '';
      const isOwn = (brand: string) => {
        const b = brand.toLowerCase();
        if (ownName) return b.includes(ownName) || (ownWord.length >= 4 && b.includes(ownWord));
        return b.includes('milk');
      };

      const aggregated = Array.from(brandMap.entries())
        .map(([brand, agg]) => ({
          brand,
          pct: Math.round((agg.totalPct / agg.count) * 10) / 10,
          deltaPts: Math.round(agg.totalDelta / agg.count),
          highlight: isOwn(brand),
        }))
        .sort((a, b) => b.pct - a.pct)
        .map((row, i) => ({ rank: i + 1, ...row }));

      setSovData(aggregated);
      setLoading(false);
    };

    fetchSov();
  }, [selectedWeek, refreshKey, activeClientId, rangeMode, rangeFrom, rangeTo, weekFilterCtx, clientName]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="shimmer h-3 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer h-2.5 w-4" />
            <div className="shimmer h-2.5 w-24" />
            <div className="shimmer h-4 flex-1" />
            <div className="shimmer h-2.5 w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (sovData.length === 0) {
    return (
      <div>
        <h3 className="section-label mb-4">Share of Voice — Competitive Set</h3>
        <div className="py-8">
          <p className="text-xs text-foreground/80 leading-relaxed">Competitive set not yet configured.</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
            Add the brands to benchmark against and share of voice will appear here.
          </p>
        </div>
      </div>
    );
  }

  const max = Math.max(...sovData.map(r => r.pct), 0.1) * 1.05;
  const own = sovData.find(r => r.highlight) ?? null;
  const leader = sovData[0];
  const above = own ? sovData.find(r => r.rank === own.rank - 1) ?? null : null;
  const below = own ? sovData.find(r => r.rank === own.rank + 1) ?? null : null;
  const focusBrand = hover ?? selected;
  const focus = focusBrand ? sovData.find(r => r.brand === focusBrand) ?? null : null;

  const headline = (() => {
    if (!own) return `${leader.brand} leads the set with ${leader.pct}%.`;
    const parts: string[] = [`${own.brand} holds #${own.rank} of ${sovData.length} with ${own.pct}%`];
    if (own.rank > 1 && leader) parts.push(`${(leader.pct - own.pct).toFixed(1)} pts behind ${leader.brand}`);
    if (below) parts.push(`${(own.pct - below.pct).toFixed(1)} pts ahead of ${below.brand}`);
    return `${parts.join(', ')}.`;
  })();

  const detailLine = (r: SovRow): string => {
    const ref = own ?? leader;
    if (r.brand === ref.brand) {
      const bits: string[] = [`#${r.rank} with ${r.pct}%`];
      if (r.rank > 1) bits.push(`${(leader.pct - r.pct).toFixed(1)} pts behind the leader`);
      if (above) bits.push(`${(above.pct - r.pct).toFixed(1)} pts to pass ${above.brand}`);
      return `${r.brand}: ${bits.join(', ')}.`;
    }
    const diff = r.pct - ref.pct;
    return `${r.brand}: #${r.rank} with ${r.pct}%, ${Math.abs(diff).toFixed(1)} pts ${diff > 0 ? 'ahead of' : 'behind'} ${ref.brand}.`;
  };

  return (
    <div>
      <h3 className="section-label mb-3">Share of Voice — Competitive Set</h3>
      <p className="text-xs leading-relaxed mb-4 min-h-[2.5rem]" aria-live="polite">
        {focus ? <span className="font-medium">{detailLine(focus)}</span> : <span className="text-foreground/80">{headline}</span>}
      </p>

      <div className="space-y-1" onMouseLeave={() => setHover(null)}>
        {sovData.map(row => {
          const on = focusBrand === row.brand;
          const dim = focusBrand != null && !on;
          return (
            <button
              key={row.brand}
              type="button"
              aria-pressed={selected === row.brand}
              onMouseEnter={() => setHover(row.brand)}
              onFocus={() => setHover(row.brand)}
              onBlur={() => setHover(null)}
              onClick={() => setSelected(prev => (prev === row.brand ? null : row.brand))}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-sm text-left transition-colors focus:outline-none focus-visible:ring-2"
              style={{
                background: row.highlight ? 'hsl(42 64% 45% / 0.12)' : on ? 'rgba(0,0,0,0.04)' : undefined,
                boxShadow: selected === row.brand ? `inset 3px 0 0 ${row.highlight ? OWN : 'rgba(0,0,0,0.45)'}` : undefined,
                opacity: dim ? 0.55 : 1,
              }}
            >
              <span className={`text-[10px] w-5 text-right tabular-nums ${row.highlight ? 'text-[hsl(42_64%_38%)] font-bold' : 'text-muted-foreground'}`}>
                #{row.rank}
              </span>
              <span className={`text-xs w-28 truncate ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/75'}`}>{row.brand}</span>
              <span className="flex-1 h-4 bg-black/[0.06] relative rounded-sm overflow-hidden">
                <span
                  className="block h-full"
                  style={{
                    width: drawn || reduced ? `${(row.pct / max) * 100}%` : '0%',
                    background: row.highlight ? `linear-gradient(90deg, ${withAlpha(OWN, 0.75)}, ${OWN})` : OTHER,
                    transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </span>
              <span className={`text-xs w-11 text-right tabular-nums ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/75'}`}>{row.pct}%</span>
              <span className="w-16 text-right">
                {row.deltaPts !== 0 ? <DeltaChip pct={row.deltaPts} suffix="pts" /> : <span className="text-[10px] text-muted-foreground">—</span>}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Hover or select a brand to compare it with {own ? own.brand : 'the leader'}. Bars are scaled to the biggest share in the set.
      </p>
    </div>
  );
};

export default ShareOfVoiceTable;
