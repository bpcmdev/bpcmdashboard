import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteEntryButton from './DeleteEntryButton';
import EditPlacementDialog from './EditPlacementDialog';

interface RawPlacement {
  id: string;
  headline: string;
  url: string;
  outlet_name: string;
  outlet_tier: number;
  outlet_umv: number | null;
  author_name: string;
  published_at: string | null;
  sentiment: string;
  ad_value: number | null;
  impressions: number | null;
  placement_type: string;
  placed_by: string;
  tags: string[];
}

const tierClass: Record<string, string> = {
  'TIER 1': 'bg-tier1',
  'TIER 2': 'bg-tier2',
  'TIER 3': 'bg-tier3',
  'CORP NEWS': 'bg-corp-news',
};

function formatReach(umv: number): string {
  if (umv >= 1_000_000) return `${(umv / 1_000_000).toFixed(1)}M reach`;
  if (umv >= 1_000) return `${(umv / 1_000).toFixed(0)}K reach`;
  return `${umv} reach`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CORP_KEYWORDS = ['waldencast', 'turnaround', 'president', 'ceo', 'cfo', 'ipo', 'earnings', 'quarterly', 'annual report', 'takes the helm', 'names', 'appoints'];

function formatTier(tier: number, placementType: string, headline: string): string {
  if (placementType === 'corporate' || placementType === 'corp') return 'CORP NEWS';
  const lower = headline.toLowerCase();
  if (CORP_KEYWORDS.some(kw => lower.includes(kw))) return 'CORP NEWS';
  return `TIER ${tier}`;
}

function formatPlacedBy(placedBy: string, placementType: string): string {
  if (placementType === 'placed') return `${placedBy} placed`;
  return 'Organic';
}

const TopPlacements = () => {
  const [rawPlacements, setRawPlacements] = useState<RawPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { selectedWeek, refreshKey } = useWeek();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchPlacements = async () => {
      setLoading(true);
      setError(false);
      const weekEnd = new Date(selectedWeek + 'T00:00:00');
      weekEnd.setDate(weekEnd.getDate() + 6);
      const endStr = weekEnd.toISOString().split('T')[0];

      const { data, error: err } = await supabase
        .from('placements')
        .select('*')
        .gte('published_at', selectedWeek)
        .lte('published_at', endStr)
        .order('outlet_umv', { ascending: false })
        .limit(10);

      if (err) {
        console.error('Failed to fetch placements:', err);
        setError(true);
        setLoading(false);
        return;
      }

      setRawPlacements((data ?? []).map((row: Record<string, any>) => ({
        id: row.id,
        headline: row.headline ?? '',
        url: row.url ?? '',
        outlet_name: row.outlet_name ?? '',
        outlet_tier: row.outlet_tier ?? 1,
        outlet_umv: row.outlet_umv ?? null,
        author_name: row.author_name ?? '',
        published_at: row.published_at ?? null,
        sentiment: row.sentiment ?? '',
        ad_value: row.ad_value ?? null,
        impressions: row.impressions ?? null,
        placement_type: row.placement_type ?? '',
        placed_by: row.placed_by ?? '',
        tags: Array.isArray(row.tags) ? row.tags : [],
      })));
      setLoading(false);
    };

    fetchPlacements();
  }, [selectedWeek, refreshKey]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rawPlacements.length === 0) {
    return (
      <div>
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Top Placements This Week</h3>
        <p className="text-xs text-muted-foreground text-center py-8">No placements for this week.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">
        Top Placements This Week
      </h3>
      <div className="divide-y divide-border">
        {rawPlacements.map((p) => {
          const tier = formatTier(p.outlet_tier, p.placement_type, p.headline);
          return (
            <div key={p.id} className="flex items-center gap-4 py-3">
              <span className="text-sm font-bold w-36 shrink-0">{p.outlet_name}</span>
              <span className="text-sm flex-1 text-foreground/80">{p.headline}</span>
              <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
                <span>{p.published_at ? formatDate(p.published_at) : ''}</span>
                <span>·</span>
                <span>{p.outlet_umv ? formatReach(p.outlet_umv) : ''}</span>
                <span>·</span>
                <span>{formatPlacedBy(p.placed_by, p.placement_type)}</span>
              </div>
              <span className={`shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 ${tierClass[tier] ?? 'bg-tier1'}`}>
                {tier}
              </span>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <EditPlacementDialog entry={p} />
                  <DeleteEntryButton table="placements" id={p.id} label={p.headline} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopPlacements;
