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

const KpiCard = ({ label, value, delta, deltaType }: KpiCardProps) => {
  const animated = useCountUp(value);
  const isPos = deltaType === 'positive';
  const isNeg = deltaType === 'negative';
  const TrendIcon = isPos ? ArrowUpRight : isNeg ? ArrowDownRight : Minus;
  const trendColor = isPos ? 'text-positive' : isNeg ? 'text-negative' : 'text-neutral-delta';

  return (
    <div className="flex-1 px-3 md:px-5 py-4 md:py-5 text-center min-w-0 relative overflow-hidden animate-fade-in bg-background">
      <p className="text-[9px] md:text-[10px] font-semibold tracking-[0.18em] uppercase text-white/45 mb-1.5 truncate">
        {label}
      </p>
      <p className="text-2xl md:text-3xl font-bold tracking-tight text-white tabular-nums">
        {animated}
      </p>
      <div className={`flex items-center justify-center gap-1 mt-1.5 ${trendColor}`}>
        <TrendIcon className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.5} />
        <span className="text-[10px] md:text-[11px] font-medium truncate">{delta.replace(/^[▲▼]\s?/, '')}</span>
      </div>
    </div>
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

function formatDelta(val: number, suffix: string): { delta: string; deltaType: 'positive' | 'negative' | 'neutral' } {
  if (val > 0) return { delta: `${val}${suffix}`, deltaType: 'positive' };
  if (val < 0) return { delta: `${Math.abs(val)}${suffix}`, deltaType: 'negative' };
  return { delta: 'stable', deltaType: 'neutral' };
}

const KpiBar = () => {
  const [kpis, setKpis] = useState<KpiCardProps[]>(fallbackKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { selectedWeek, refreshKey, activeClientId } = useWeek();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchKpis = async () => {
      setLoading(true);
      setError(false);
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
        { label: 'Press Placements', value: String(r.placement_count ?? 0), ...placementDelta },
        { label: 'Earned Media Value', value: `$${formatCompact(r.emv_usd ?? 0)}`, ...emvDelta },
        { label: 'Sentiment Score', value: `${r.sentiment_score ?? 0}/100`, ...sentimentDelta },
        { label: 'Social Reach', value: formatCompact(r.social_reach ?? 0), ...reachDelta },
        { label: 'Share of Voice', value: `${r.sov_pct ?? 0}%`, ...sovDelta },
        { label: 'Influencer ROI', value: `${roiVal}x`, delta: 'stable', deltaType: 'neutral' },
      ]);
      setLoading(false);
    };

    fetchKpis();
  }, [selectedWeek, refreshKey, activeClientId]);

  if (error) {
    return (
      <div className="bg-card border-b border-border px-5 py-4 text-center">
        <p className="text-sm text-destructive">Unable to load data. Please try refreshing.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:flex divide-x divide-white/[0.08] border-b border-white/[0.08] bg-background">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 px-3 md:px-5 py-4 md:py-5 text-center space-y-2">
            <Skeleton className="h-3 w-16 md:w-20 mx-auto bg-white/10" />
            <Skeleton className="h-7 md:h-8 w-14 md:w-20 mx-auto bg-white/10" />
            <Skeleton className="h-3 w-20 md:w-24 mx-auto bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:flex divide-x divide-white/[0.08] border-b border-white/[0.08] bg-background">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};

export default KpiBar;
