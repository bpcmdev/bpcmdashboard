import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

interface Bucket {
  label: string;
  placements: number;
}

function startOfWeekISO(d: Date): string {
  // ISO Mon-start week
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(mon.getDate() + diff);
  return mon.toISOString().split('T')[0];
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PlacementVolumeChart = () => {
  const { activeClientId, refreshKey, rangeMode, effectiveFrom, effectiveTo, selectedWeek } = useWeek();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('Placement Volume');

  useEffect(() => {
    if (!effectiveFrom || !effectiveTo) return;

    const fetch = async () => {
      setLoading(true);
      // For week mode, show trailing 8 weeks ending at the selected week.
      // For range mode, show buckets across the selected range (daily if <=14d else weekly).
      let from = effectiveFrom;
      let to = effectiveTo;

      if (rangeMode === 'week' && selectedWeek) {
        const end = new Date(selectedWeek + 'T00:00:00');
        end.setDate(end.getDate() + 6);
        const start = new Date(selectedWeek + 'T00:00:00');
        start.setDate(start.getDate() - 7 * 7); // 8 weeks back including current
        from = start.toISOString().split('T')[0];
        to = end.toISOString().split('T')[0];
        setTitle('Placement Volume — 8 Weeks');
      } else {
        setTitle('Placement Volume');
      }

      let query = supabase
        .from('placements')
        .select('published_at')
        .gte('published_at', from)
        .lte('published_at', to);
      if (activeClientId) query = query.eq('client_id', activeClientId);

      const { data, error } = await query;
      if (error) {
        console.error('PlacementVolumeChart fetch error', error);
        setBuckets([]);
        setLoading(false);
        return;
      }

      const fromD = new Date(from + 'T00:00:00');
      const toD = new Date(to + 'T00:00:00');
      const daySpan = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
      const useDaily = rangeMode === 'range' && daySpan <= 14;

      const counts = new Map<string, number>();

      // Initialize empty buckets to keep gaps
      if (useDaily) {
        for (let i = 0; i < daySpan; i++) {
          const d = new Date(fromD);
          d.setDate(d.getDate() + i);
          counts.set(d.toISOString().split('T')[0], 0);
        }
      } else {
        const cursor = new Date(startOfWeekISO(fromD) + 'T00:00:00');
        while (cursor <= toD) {
          counts.set(cursor.toISOString().split('T')[0], 0);
          cursor.setDate(cursor.getDate() + 7);
        }
      }

      (data ?? []).forEach((row: any) => {
        if (!row.published_at) return;
        const d = new Date(row.published_at + 'T00:00:00');
        const key = useDaily ? row.published_at : startOfWeekISO(d);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });

      const out: Bucket[] = Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ label: fmtShort(new Date(k + 'T00:00:00')), placements: v }));

      setBuckets(out);
      setLoading(false);
    };

    fetch();
  }, [activeClientId, refreshKey, rangeMode, effectiveFrom, effectiveTo, selectedWeek]);

  const yMax = Math.max(10, ...buckets.map(b => b.placements));

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        {title}
      </h3>
      {loading ? (
        <Skeleton className="h-[240px] w-full" />
      ) : buckets.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
          No placements in selected range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={buckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
              axisLine={{ stroke: 'hsl(0 0% 90%)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0 0% 9%)',
                border: 'none',
                borderRadius: '2px',
                color: 'white',
                fontSize: 11,
              }}
            />
            <Bar dataKey="placements" fill="hsl(0 0% 9%)" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default PlacementVolumeChart;
