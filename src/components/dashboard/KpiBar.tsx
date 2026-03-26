import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

function getDeltaType(delta: string): 'positive' | 'negative' | 'neutral' {
  if (delta.includes('▲') || delta.includes('+')) return 'positive';
  if (delta.includes('▼') || delta.includes('-')) return 'negative';
  return 'neutral';
}

const KpiBar = () => {
  const [kpis, setKpis] = useState<KpiCardProps[]>(fallbackKpis);

  useEffect(() => {
    const fetchKpis = async () => {
      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.error('Failed to fetch weekly_snapshots:', error);
        return;
      }

      const row = data as Record<string, any>;
      setKpis([
        { label: 'Press Placements', value: String(row.press_placements ?? '47'), delta: row.press_placements_delta ?? '▲ 31% vs prior week', deltaType: getDeltaType(row.press_placements_delta ?? '▲') },
        { label: 'Earned Media Value', value: row.earned_media_value ?? '$2.1M', delta: row.earned_media_value_delta ?? '▲ 18%', deltaType: getDeltaType(row.earned_media_value_delta ?? '▲') },
        { label: 'Sentiment Score', value: row.sentiment_score ?? '72/100', delta: row.sentiment_score_delta ?? '▲ 8pts MoM', deltaType: getDeltaType(row.sentiment_score_delta ?? '▲') },
        { label: 'Social Reach', value: row.social_reach ?? '6.4M', delta: row.social_reach_delta ?? '▲ 22%', deltaType: getDeltaType(row.social_reach_delta ?? '▲') },
        { label: 'Share of Voice', value: row.share_of_voice ?? '21%', delta: row.share_of_voice_delta ?? '▲ 4pts', deltaType: getDeltaType(row.share_of_voice_delta ?? '▲') },
        { label: 'Influencer ROI', value: row.influencer_roi ?? '4.2x', delta: row.influencer_roi_delta ?? '— stable', deltaType: getDeltaType(row.influencer_roi_delta ?? '—') },
      ]);
    };

    fetchKpis();
  }, []);

  return (
    <div className="bg-card flex divide-x divide-border border-b border-border">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};

export default KpiBar;
