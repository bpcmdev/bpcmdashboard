import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

interface TierData {
  name: string;
  value: number;
  color: string;
}

const CoverageByTier = () => {
  const [data, setData] = useState<TierData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { refreshKey, activeClientId, effectiveFrom, effectiveTo } = useWeek();

  useEffect(() => {
    if (!effectiveFrom || !effectiveTo) return;
    const fetchTiers = async () => {
      setLoading(true);
      setError(false);

      let query = supabase
        .from('placements')
        .select('outlet_tier')
        .gte('published_at', effectiveFrom)
        .lte('published_at', effectiveTo);
      if (activeClientId) query = query.eq('client_id', activeClientId);

      const { data: placements, error: err } = await query;

      if (err) {
        console.error('Failed to fetch tier data:', err);
        setError(true);
        setLoading(false);
        return;
      }

      if (placements && placements.length > 0) {
        const counts: Record<number, number> = {};
        placements.forEach((p: any) => {
          const tier = p.outlet_tier ?? 3;
          counts[tier] = (counts[tier] || 0) + 1;
        });
        setData([
          { name: 'Tier 1', value: counts[1] || 0, color: 'hsl(0 0% 9%)' },
          { name: 'Tier 2', value: counts[2] || 0, color: 'hsl(0 0% 35%)' },
          { name: 'Tier 3', value: counts[3] || 0, color: 'hsl(0 0% 70%)' },
        ]);
      } else {
        setData([
          { name: 'Tier 1', value: 0, color: 'hsl(0 0% 9%)' },
          { name: 'Tier 2', value: 0, color: 'hsl(0 0% 35%)' },
          { name: 'Tier 3', value: 0, color: 'hsl(0 0% 70%)' },
        ]);
      }
      setLoading(false);
    };
    fetchTiers();
  }, [effectiveFrom, effectiveTo, refreshKey, activeClientId]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[160px] w-[160px] rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Coverage by Outlet Tier
      </h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" stroke="none">
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: item.color }} />
              <span className="text-xs">{item.name}</span>
              <span className="text-xs font-bold ml-1">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CoverageByTier;
