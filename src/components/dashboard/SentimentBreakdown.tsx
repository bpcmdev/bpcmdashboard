import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { usePrefersReducedMotion, withAlpha } from './influencerCardKit';

interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
  classified: number;
  total: number;
}

type Kind = 'positive' | 'neutral' | 'negative';

const COLORS: Record<Kind, string> = {
  positive: 'hsl(225 70% 35%)',
  neutral: 'hsl(0 0% 62%)',
  negative: 'hsl(0 70% 50%)',
};
const LABELS: Record<Kind, string> = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' };
const ORDER: Kind[] = ['positive', 'neutral', 'negative'];

// Donut geometry (SVG units)
const SIZE = 180;
const CENTER = SIZE / 2;
const RADIUS = 64;
const STROKE = 24;
const CIRC = 2 * Math.PI * RADIUS;
const GAP = 3;

const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

const SentimentBreakdown = () => {
  const [counts, setCounts] = useState<SentimentCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<Kind | null>(null);
  const [selected, setSelected] = useState<Kind | null>(null);
  const [drawn, setDrawn] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { refreshKey, activeClientId, effectiveFrom, effectiveTo, isAllTime } = useWeek();

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;

    const fetchSentiment = async () => {
      setLoading(true);
      setError(false);

      let query = supabase.from('placements').select('sentiment');
      if (!isAllTime) {
        query = query.gte('published_at', effectiveFrom).lte('published_at', effectiveTo);
      }
      if (activeClientId) query = query.eq('client_id', activeClientId);

      const { data: rows, error: err } = await query;

      if (err) {
        console.error('Failed to fetch sentiment:', err);
        setError(true);
        setLoading(false);
        return;
      }

      const list = rows ?? [];
      const tally = { positive: 0, neutral: 0, negative: 0 };
      list.forEach((r: any) => {
        const s = typeof r.sentiment === 'string' ? r.sentiment.toLowerCase() : null;
        if (s === 'positive' || s === 'neutral' || s === 'negative') tally[s] += 1;
      });

      setCounts({
        ...tally,
        classified: tally.positive + tally.neutral + tally.negative,
        total: list.length,
      });
      setLoading(false);
    };

    fetchSentiment();
  }, [effectiveFrom, effectiveTo, isAllTime, refreshKey, activeClientId]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading || !counts) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-3 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="shimmer h-2.5 w-16" />
                <div className="shimmer h-2.5 w-8" />
              </div>
              <div className="shimmer h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (counts.classified === 0) {
    return (
      <div>
        <h3 className="section-label mb-4">Sentiment Breakdown</h3>
        <div className="py-8">
          <p className="text-xs text-foreground/80 leading-relaxed">
            Sentiment analysis not yet available — awaiting classification.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
            Sentiment isn&apos;t included in the current Launchmetrics tier, so none of the
            {counts.total > 0 ? ` ${counts.total.toLocaleString()} placement${counts.total !== 1 ? 's' : ''} in this range have` : ' placements have'}{' '}
            a sentiment value recorded.
          </p>
        </div>
      </div>
    );
  }

  const coverage = counts.total > 0 ? (counts.classified / counts.total) * 100 : 100;
  const lowCoverage = counts.total > counts.classified && coverage < 25;
  const smallSample = counts.classified < 30;
  const net = Math.round((counts.positive / counts.classified) * 100 - (counts.negative / counts.classified) * 100);

  let acc = 0;
  const slices = ORDER.map(k => {
    const v = counts[k];
    const frac = v / counts.classified;
    const full = frac * CIRC;
    const slice = { kind: k, v, frac, len: Math.max(full - (v > 0 ? GAP : 0), v > 0 ? 2 : 0), start: acc + GAP / 2 };
    acc += full;
    return slice;
  }).filter(s => s.v > 0);

  const active = hover ?? selected;
  const act = active ? slices.find(s => s.kind === active) ?? null : null;
  const lead = [...slices].sort((a, b) => b.v - a.v)[0];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="section-label">Sentiment Breakdown</h3>
        <span
          className="text-[10px] font-bold tabular-nums px-2 py-0.5"
          style={{
            background: net >= 0 ? withAlpha('hsl(225 70% 35%)', 0.1) : withAlpha('hsl(0 70% 50%)', 0.12),
            color: net >= 0 ? 'hsl(225 70% 30%)' : 'hsl(0 70% 40%)',
          }}
          title="Share of positive mentions minus share of negative mentions, in points"
        >
          Net {net > 0 ? `+${net}` : net}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-44 h-44 shrink-0 select-none"
          role="img"
          aria-label={`Sentiment of ${counts.classified} classified placements: ${slices.map(s => `${LABELS[s.kind]} ${Math.round(s.frac * 100)}%`).join(', ')}`}
          onMouseLeave={() => setHover(null)}
        >
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="hsl(0 0% 94%)" strokeWidth={STROKE} />
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {slices.map(s => {
              const isActive = active === s.kind;
              const dim = active != null && !isActive;
              return (
                <circle
                  key={s.kind}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={COLORS[s.kind]}
                  strokeWidth={isActive ? STROKE + 8 : STROKE}
                  strokeDasharray={`${drawn || reduced ? s.len : 0} ${CIRC}`}
                  strokeDashoffset={-s.start}
                  opacity={dim ? 0.3 : 1}
                  style={{
                    cursor: 'pointer',
                    transition: reduced ? undefined : 'stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1), stroke-width 160ms ease, opacity 160ms ease',
                    filter: isActive ? `drop-shadow(0 2px 6px ${withAlpha(COLORS[s.kind], 0.5)})` : undefined,
                  }}
                  onMouseEnter={() => setHover(s.kind)}
                  onClick={() => setSelected(prev => (prev === s.kind ? null : s.kind))}
                />
              );
            })}
          </g>
          <g style={{ pointerEvents: 'none' }} textAnchor="middle">
            <text x={CENTER} y={CENTER - 8} style={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}>
              {act ? LABELS[act.kind] : lead ? `Mostly ${LABELS[lead.kind].toLowerCase()}` : ''}
            </text>
            <text x={CENTER} y={CENTER + 18} className="font-display" style={{ fontSize: 30, fontWeight: 700, fill: act ? COLORS[act.kind] : lead ? COLORS[lead.kind] : 'hsl(0 0% 12%)' }}>
              {act ? pct(act.frac * 100) : lead ? pct(lead.frac * 100) : ''}
            </text>
          </g>
        </svg>

        <ul className="w-full space-y-1.5" onMouseLeave={() => setHover(null)}>
          {ORDER.map(k => {
            const v = counts[k];
            const frac = v / counts.classified;
            const on = active === k;
            return (
              <li key={k}>
                <button
                  type="button"
                  aria-pressed={selected === k}
                  onMouseEnter={() => setHover(k)}
                  onFocus={() => setHover(k)}
                  onBlur={() => setHover(null)}
                  onClick={() => setSelected(prev => (prev === k ? null : k))}
                  className="relative w-full flex items-center gap-3 px-2.5 py-2 text-left overflow-hidden transition-colors focus:outline-none focus-visible:ring-2"
                  style={{ background: on ? withAlpha(COLORS[k], 0.1) : undefined, boxShadow: selected === k ? `inset 3px 0 0 ${COLORS[k]}` : undefined }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: drawn || reduced ? `${frac * 100}%` : '0%',
                      background: withAlpha(COLORS[k], 0.09),
                      transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                  <span className="relative w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[k] }} aria-hidden />
                  <span className="relative text-xs font-medium flex-1">{LABELS[k]}</span>
                  <span className="relative text-xs tabular-nums text-muted-foreground">{v.toLocaleString()}</span>
                  <span className="relative text-xs font-bold tabular-nums w-10 text-right">{pct(frac * 100)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {counts.total > counts.classified && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Sentiment coverage</span>
            <span className="text-[11px] tabular-nums">
              <span className="font-bold">{counts.classified.toLocaleString()}</span>
              <span className="text-muted-foreground"> of {counts.total.toLocaleString()} placements ({pct(coverage, coverage < 10 ? 1 : 0)})</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-black/[0.07]" aria-hidden>
            <div
              className="h-full"
              style={{
                width: `${Math.max(coverage, 1.5)}%`,
                background: lowCoverage ? 'hsl(36 90% 50%)' : 'hsl(225 70% 35%)',
                transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>
        </div>
      )}

      {(lowCoverage || smallSample) && (
        <p className="text-[11px] mt-3 px-3 py-2 leading-relaxed" style={{ background: 'hsl(36 90% 50% / 0.1)', color: 'hsl(30 60% 26%)' }}>
          {smallSample
            ? `This reads ${LABELS[lead.kind].toLowerCase()}, but it rests on only ${counts.classified.toLocaleString()} classified placement${counts.classified === 1 ? '' : 's'}, so treat it as a directional signal rather than a verdict.`
            : 'Most placements have no sentiment recorded, so treat this as directional.'}
        </p>
      )}
    </div>
  );
};

export default SentimentBreakdown;
