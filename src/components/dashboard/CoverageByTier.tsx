import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';

interface TierData {
  name: string;
  value: number;
  color: string;
}

const CoverageByTier = ({ corporateOnly = false }: { corporateOnly?: boolean }) => {
  const [data, setData] = useState<TierData[]>([]);
  const [unrated, setUnrated] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { refreshKey, activeClientId, effectiveFrom, effectiveTo, isAllTime } = useWeek();

  useEffect(() => {
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    const fetchTiers = async () => {
      setLoading(true);
      setError(false);

      let query = supabase
        .from('placements')
        .select('outlet_tier');
      if (!isAllTime) {
        query = query.gte('published_at', effectiveFrom).lte('published_at', effectiveTo);
      }
      if (activeClientId) query = query.eq('client_id', activeClientId);
      // Corporate/Executive is a manual classification set per placement in the press log.
      if (corporateOnly) query = query.in('placement_type', ['corporate', 'newswire']);

      const { data: placements, error: err } = await query;

      if (err) {
        console.error('Failed to fetch tier data:', err);
        setError(true);
        setLoading(false);
        return;
      }

      const tier1Color = 'hsl(225 70% 35%)';
      const tier2Color = 'hsl(42 64% 45%)';
      const tier3Color = 'hsl(0 0% 60%)';
      const unratedColor = 'hsl(0 0% 82%)';
      const rows = placements ?? [];
      const counts: Record<number, number> = {};
      let noTier = 0;
      rows.forEach((p: any) => {
        if (p.outlet_tier == null) { noTier += 1; return; }
        counts[p.outlet_tier] = (counts[p.outlet_tier] || 0) + 1;
      });
      setUnrated(noTier);
      setTotal(rows.length);
      setData([
        { name: 'Tier 1', value: counts[1] || 0, color: tier1Color },
        { name: 'Tier 2', value: counts[2] || 0, color: tier2Color },
        { name: 'Tier 3', value: counts[3] || 0, color: tier3Color },
        ...(noTier > 0 ? [{ name: 'Unrated', value: noTier, color: unratedColor }] : []),
      ]);
      setLoading(false);
    };
    fetchTiers();
  }, [effectiveFrom, effectiveTo, isAllTime, refreshKey, activeClientId, corporateOnly]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-3 w-40" />
        <div className="flex items-center gap-6">
          <div className="shimmer h-[160px] w-[160px] rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer h-3 w-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div>
        <h3 className="section-label mb-4">Coverage by Outlet Tier</h3>
        <p className="text-xs text-muted-foreground leading-relaxed py-8">
          {corporateOnly
            ? 'No placements classified as Corporate or Newswire yet. Classification is set manually per placement in the press log.'
            : 'No placements in the selected range.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="section-label mb-4">Coverage by Outlet Tier</h3>
      {unrated > 0 && (
        <p className="text-[10px] text-muted-foreground mb-3">
          {unrated} of {total} placement{total !== 1 ? 's' : ''} have no outlet tier recorded.
        </p>
      )}
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
              activeIndex={activeIndex ?? undefined}
              activeShape={(props: any) => <Sector {...props} outerRadius={props.outerRadius + 5} />}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationBegin={80}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any) => [`${value} placement${value === 1 ? '' : 's'}`, name]}
              contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', color: 'hsl(0 0% 8%)', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center gap-2 cursor-default transition-opacity"
              style={{ opacity: activeIndex === null || activeIndex === index ? 1 : 0.5 }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="w-3 h-3" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-foreground/70">{item.name}</span>
              <span className="text-xs font-bold ml-1 text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CoverageByTier;
