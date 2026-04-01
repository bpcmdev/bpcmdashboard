import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'neutral';
}

const KpiCard = ({ label, value, delta, deltaType }: KpiCardProps) => {
  const deltaColor = deltaType === 'positive' ? 'text-positive' : deltaType === 'negative' ? 'text-negative' : 'text-neutral-delta';
  return (
    <div className="flex-1 px-5 py-4 text-center">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className={`text-[11px] mt-0.5 ${deltaColor}`}>{delta}</p>
    </div>
  );
};

const fallbackKpis: KpiCardProps[] = [
  { label: 'Press Placements', value: '47', delta: '▲ 31% vs prior week', deltaType: 'positive' },
  { label: 'Earned Media Value', value: '$2.1M', delta: '▲ 18%', deltaType: 'positive' },
  { label: 'Sentiment Score', value: '72/100', delta: '▲ 8pts MoM', deltaType: 'positive' },
  { label: 'Social Reach', value: '6.4M', delta: '▲ 22%', deltaType: 'positive' },
  { label: 'Share of Voice', value: '21%', delta: '▲ 4pts', deltaType: 'positive' },
  { label: 'Influencer ROI', value: '4.2x', delta: '— stable', deltaType: 'neutral' },
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
  const { selectedWeek, refreshKey } = useWeek();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchKpis = async () => {
      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('*')
        .eq('week_start', selectedWeek)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        console.error('Failed to fetch weekly_snapshots:', error);
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
    };

    fetchKpis();
  }, [selectedWeek]);

  return (
    <div className="bg-card flex divide-x divide-border border-b border-border">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};

export default KpiBar;
