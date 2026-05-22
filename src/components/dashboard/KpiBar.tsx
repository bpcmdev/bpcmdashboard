import { useEffect, useState, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'neutral';
  targetTab?: string;
}

/** Animate a numeric value from 0 → target over `duration` ms. Non-numeric values are returned as-is. */
function useCountUp(target: string, duration = 900): string {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Extract a leading number (handles "$1.2M", "78/100", "45%", "3.2x", "0")
    const match = target.match(/^([^\d-]*)(-?[\d.]+)(.*)$/);
    if (!match) {
      setDisplay(target);
      return;
    }
    const prefix = match[1];
    const end = parseFloat(match[2]);
    const suffix = match[3];
    if (Number.isNaN(end)) {
      setDisplay(target);
      return;
    }
    const decimals = (match[2].split('.')[1] ?? '').length;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const cur = end * eased;
      setDisplay(`${prefix}${cur.toFixed(decimals)}${suffix}`);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

const KpiCard = ({ label, value, delta, deltaType, targetTab }: KpiCardProps) => {
  const animated = useCountUp(value);
  const isPos = deltaType === 'positive';
  const isNeg = deltaType === 'negative';
  const TrendIcon = isPos ? ArrowUpRight : isNeg ? ArrowDownRight : Minus;
  const trendColor = isPos ? 'text-positive' : isNeg ? 'text-negative' : 'text-neutral-delta';

  const handleClick = () => {
    if (!targetTab) return;
    window.dispatchEvent(new CustomEvent('bpcm:switch-tab', { detail: targetTab }));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex-1 px-3 md:px-5 py-4 md:py-5 text-center min-w-0 relative overflow-hidden animate-fade-in bg-white border-r border-black/10 transition-all duration-200 hover:bg-[hsl(0,0%,98%)] hover:border-b-2 hover:border-b-[hsl(225,70%,35%)] ${targetTab ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <p className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[0.18em] uppercase text-muted-foreground mb-1.5 truncate">
        {label}
      </p>
      <p className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground tabular-nums leading-none">
        {animated}
      </p>
      <div className={`flex items-center justify-center gap-1 mt-2 ${trendColor}`}>
        <TrendIcon className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.5} />
        <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[0.18em] uppercase truncate">{delta.replace(/^[▲▼]\s?/, '')}</span>
      </div>
    </button>
  );
};

const fallbackKpis: KpiCardProps[] = [
  { label: 'Press Placements', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Earned Media Value', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Sentiment Score', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Social Reach', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Share of Voice', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Influencer ROI', value: '—', delta: '—', deltaType: 'neutral' },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

type DeltaFmt = 'int' | 'currency' | 'compact' | 'points';

function formatDeltaValue(val: number, fmt: DeltaFmt): string {
  const abs = Math.abs(val);
  switch (fmt) {
    case 'currency':
      return abs >= 1_000_000
        ? `$${(abs / 1_000_000).toFixed(1)}M`
        : abs >= 1_000
        ? `$${(abs / 1_000).toFixed(1)}K`
        : `$${abs.toLocaleString()}`;
    case 'compact':
      return abs >= 1_000_000
        ? `${(abs / 1_000_000).toFixed(1)}M`
        : abs >= 1_000
        ? `${(abs / 1_000).toFixed(0)}K`
        : String(abs);
    case 'points':
      return `${abs} pts`;
    case 'int':
    default:
      return String(abs);
  }
}

function formatDelta(val: number, fmt: DeltaFmt, suffix = 'vs prior week'): { delta: string; deltaType: 'positive' | 'negative' | 'neutral' } {
  if (!val || !Number.isFinite(val)) return { delta: 'stable', deltaType: 'neutral' };
  const sign = val > 0 ? '+' : '−';
  const formatted = formatDeltaValue(val, fmt);
  return {
    delta: `${sign}${formatted} ${suffix}`,
    deltaType: val > 0 ? 'positive' : 'negative',
  };
}

const KpiBar = () => {
  const [kpis, setKpis] = useState<KpiCardProps[]>(fallbackKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { selectedWeek, refreshKey, activeClientId, isAllTime } = useWeek();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchKpis = async () => {
      setLoading(true);
      setError(false);

      if (isAllTime) {
        // Aggregate across all weekly_snapshots for the active client.
        let q = supabase.from('weekly_snapshots').select('*');
        if (activeClientId) q = q.eq('client_id', activeClientId);
        const { data, error: err } = await q;
        if (err) {
          console.error('Failed to fetch weekly_snapshots:', err);
          setError(true);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as Record<string, any>[];
        if (rows.length === 0) {
          setKpis(fallbackKpis);
          setLoading(false);
          return;
        }
        const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
        const avg = (k: string) => {
          const vals = rows.map(r => Number(r[k])).filter(v => Number.isFinite(v) && v !== 0);
          return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        };
        const placements = sum('placement_count');
        const emv = sum('emv_usd');
        const reach = sum('social_reach');
        const sentiment = Math.round(avg('sentiment_score'));
        const sov = Number(avg('sov_pct').toFixed(1));
        const roi = Number(avg('influencer_roi').toFixed(1));
        const allTimeDelta = { delta: `${rows.length} weeks`, deltaType: 'neutral' as const };

        setKpis([
          { label: 'Press Placements', value: String(placements), ...allTimeDelta, targetTab: 'EARNED MEDIA' },
          { label: 'Earned Media Value', value: `$${formatCompact(emv)}`, ...allTimeDelta, targetTab: 'EARNED MEDIA' },
          { label: 'Sentiment Score', value: `${sentiment}/100`, ...allTimeDelta },
          { label: 'Social Reach', value: formatCompact(reach), ...allTimeDelta, targetTab: 'INFLUENCER & SOCIAL' },
          { label: 'Share of Voice', value: `${sov}%`, ...allTimeDelta },
          { label: 'Influencer ROI', value: `${roi}x`, ...allTimeDelta, targetTab: 'INFLUENCER & SOCIAL' },
        ]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('weekly_snapshots')
        .select('*')
        .eq('week_start', selectedWeek)
        .limit(1);

      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      }

      const { data, error: err } = await query.maybeSingle();

      if (err) {
        console.error('Failed to fetch weekly_snapshots:', err);
        setError(true);
        setLoading(false);
        return;
      }

      if (!data) {
        setKpis(fallbackKpis);
        setLoading(false);
        return;
      }

      const r = data as Record<string, any>;
      const placementDelta = formatDelta(r.wow_placement_delta ?? 0, '% vs prior week');
      const emvDelta = formatDelta(r.wow_emv_delta ?? 0, '%');
      const sentimentDelta = formatDelta(r.mom_sentiment_delta ?? 0, 'pts MoM');
      const reachDelta = formatDelta(r.wow_reach_delta ?? 0, '%');
      const sovDelta = formatDelta(r.sov_delta_pts ?? 0, 'pts');
      const roiVal = r.influencer_roi ?? 0;

      setKpis([
        { label: 'Press Placements', value: String(r.placement_count ?? 0), ...placementDelta, targetTab: 'EARNED MEDIA' },
        { label: 'Earned Media Value', value: `$${formatCompact(r.emv_usd ?? 0)}`, ...emvDelta, targetTab: 'EARNED MEDIA' },
        { label: 'Sentiment Score', value: `${r.sentiment_score ?? 0}/100`, ...sentimentDelta },
        { label: 'Social Reach', value: formatCompact(r.social_reach ?? 0), ...reachDelta, targetTab: 'INFLUENCER & SOCIAL' },
        { label: 'Share of Voice', value: `${r.sov_pct ?? 0}%`, ...sovDelta },
        { label: 'Influencer ROI', value: `${roiVal}x`, delta: 'stable', deltaType: 'neutral', targetTab: 'INFLUENCER & SOCIAL' },
      ]);
      setLoading(false);
    };

    fetchKpis();
  }, [selectedWeek, refreshKey, activeClientId, isAllTime]);

  if (error) {
    return (
      <div className="bg-white border-b border-black/10 px-5 py-4 text-center">
        <p className="text-sm text-destructive">Unable to load data. Please try refreshing.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:flex border-b border-black/10 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 px-3 md:px-5 py-4 md:py-5 text-center space-y-2 border-r border-black/10">
            <Skeleton className="h-3 w-16 md:w-20 mx-auto" />
            <Skeleton className="h-7 md:h-8 w-14 md:w-20 mx-auto" />
            <Skeleton className="h-3 w-20 md:w-24 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:flex border-b border-black/10 bg-white">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};

export default KpiBar;
