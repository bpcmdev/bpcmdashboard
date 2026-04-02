import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'neutral';
}

const KpiCard = ({ label, value, delta, deltaType }: KpiCardProps) => {
  const deltaColor = deltaType === 'positive' ? 'text-positive' : deltaType === 'negative' ? 'text-negative' : 'text-neutral-delta';
  return (
    <div className="flex-1 px-3 md:px-5 py-3 md:py-4 text-center min-w-0">
      <p className="text-[9px] md:text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1 truncate">{label}</p>
      <p className="text-lg md:text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className={`text-[10px] md:text-[11px] mt-0.5 ${deltaColor} truncate`}>{delta}</p>
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
  if (val > 0) return { delta: `▲ ${val}${suffix}`, deltaType: 'positive' };
  if (val < 0) return { delta: `▼ ${Math.abs(val)}${suffix}`, deltaType: 'negative' };
  return { delta: '— stable', deltaType: 'neutral' };
}

const KpiBar = () => {
  const [kpis, setKpis] = useState<KpiCardProps[]>(fallbackKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { selectedWeek, refreshKey } = useWeek();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchKpis = async () => {
      setLoading(true);
      setError(false);
      const { data, error: err } = await supabase
        .from('weekly_snapshots')
        .select('*')
        .eq('week_start', selectedWeek)
        .limit(1)
        .maybeSingle();

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
        { label: 'Influencer ROI', value: `${roiVal}x`, delta: '— stable', deltaType: 'neutral' },
      ]);
      setLoading(false);
    };

    fetchKpis();
  }, [selectedWeek, refreshKey]);

  if (error) {
    return (
      <div className="bg-card border-b border-border px-5 py-4 text-center">
        <p className="text-sm text-destructive">Unable to load data. Please try refreshing.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card grid grid-cols-3 md:flex divide-x divide-border border-b border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 px-3 md:px-5 py-3 md:py-4 text-center space-y-2">
            <Skeleton className="h-3 w-16 md:w-20 mx-auto" />
            <Skeleton className="h-6 md:h-7 w-12 md:w-16 mx-auto" />
            <Skeleton className="h-3 w-20 md:w-24 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card grid grid-cols-3 md:flex divide-x divide-border border-b border-border">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};

export default KpiBar;
