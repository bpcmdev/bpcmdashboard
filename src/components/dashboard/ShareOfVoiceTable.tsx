import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

interface SovRow {
  rank: number;
  brand: string;
  pct: number;
  delta: string;
  highlight: boolean;
}

function formatDeltaPts(pts: number): string {
  if (pts > 0) return `▲+${pts}pts`;
  if (pts < 0) return `${pts}pt${Math.abs(pts) !== 1 ? 's' : ''}`;
  return '—';
}

const ShareOfVoiceTable = () => {
  const [sovData, setSovData] = useState<SovRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { selectedWeek, refreshKey, activeClientId, rangeMode, rangeFrom, rangeTo } = useWeek();

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
      if (rangeMode === 'range') {
        query = query.gte('week_start', rangeFrom).lte('week_start', rangeTo);
      } else {
        query = query.eq('week_start', selectedWeek);
      }

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

      const aggregated = Array.from(brandMap.entries())
        .map(([brand, agg]) => ({
          brand,
          pct: Math.round((agg.totalPct / agg.count) * 10) / 10,
          deltaPts: Math.round(agg.totalDelta / agg.count),
          highlight: brand.toLowerCase().includes('milk'),
        }))
        .sort((a, b) => b.pct - a.pct)
        .map((row, i) => ({
          rank: i + 1,
          brand: row.brand,
          pct: row.pct,
          delta: formatDeltaPts(row.deltaPts),
          highlight: row.highlight,
        }));

      setSovData(aggregated);
      setLoading(false);
    };

    fetchSov();
  }, [selectedWeek, refreshKey, activeClientId, rangeMode, rangeFrom, rangeTo]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Share of Voice — Competitive Set
      </h3>
      <div className="space-y-2.5">
        {sovData.map((row) => (
          <div key={row.brand} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-4 text-right">#{row.rank}</span>
            <span className={`text-xs w-32 truncate ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/80'}`}>
              {row.brand}
            </span>
            <div className="flex-1 h-4 bg-secondary relative">
              <div
                className={`h-full ${row.highlight ? 'bg-foreground' : 'bg-foreground/40'}`}
                style={{ width: `${(row.pct / 25) * 100}%` }}
              />
            </div>
            <span className={`text-xs w-8 text-right ${row.highlight ? 'font-bold' : ''}`}>{row.pct}%</span>
            <span className={`text-[10px] w-14 text-right ${
              row.delta.includes('▲') ? 'text-positive' : row.delta.includes('-') ? 'text-negative' : 'text-neutral-delta'
            }`}>
              {row.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShareOfVoiceTable;
