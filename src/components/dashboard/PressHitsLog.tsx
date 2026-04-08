import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { X, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Placement {
  id: string;
  headline: string;
  url: string;
  outlet_name: string;
  outlet_tier: number;
  outlet_umv: number | null;
  published_at: string | null;
  placement_type: string;
  placed_by: string;
}

function formatReach(val: number | null): string {
  if (!val) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tierLabel(tier: number): string {
  return `TIER ${tier}`;
}

const tierBg: Record<number, string> = {
  1: 'bg-tier1',
  2: 'bg-tier2',
  3: 'bg-tier3',
};

function placementLabel(placedBy: string, placementType: string): string {
  if (placementType === 'placed' || (placedBy && placedBy.toLowerCase() !== 'organic')) return 'BPCM Placed';
  return 'Organic';
}

const PressHitsLog = () => {
  const { selectedWeek, refreshKey, activeClientId } = useWeek();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<Placement | null>(null);

  // Manual entry form
  const [newOutlet, setNewOutlet] = useState('');
  const [newHeadline, setNewHeadline] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedWeek) return;
    const fetch = async () => {
      setLoading(true);
      const weekEnd = new Date(selectedWeek + 'T00:00:00');
      weekEnd.setDate(weekEnd.getDate() + 6);
      const endStr = weekEnd.toISOString().split('T')[0];

      let query = supabase
        .from('placements')
        .select('id, headline, url, outlet_name, outlet_tier, outlet_umv, published_at, placement_type, placed_by')
        .gte('published_at', selectedWeek)
        .lte('published_at', endStr)
        .order('published_at', { ascending: false });

      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      }

      const { data } = await query;
      setPlacements(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [selectedWeek, refreshKey, activeClientId]);

  const visible = useMemo(
    () => placements.filter((p) => !dismissed.has(p.id)),
    [placements, dismissed]
  );

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const handleAddHit = async () => {
    if (!newOutlet.trim() || !newHeadline.trim()) {
      toast.error('Outlet name and headline are required.');
      return;
    }
    setSubmitting(true);

    // Resolve week_id
    let weekQuery = supabase
      .from('weekly_snapshots')
      .select('id')
      .eq('week_start', selectedWeek);
    if (activeClientId) weekQuery = weekQuery.eq('client_id', activeClientId);
    const { data: weekRow } = await weekQuery.maybeSingle();

    if (!weekRow) {
      toast.error('No weekly snapshot found for this week. Create one first.');
      setSubmitting(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('placements').insert({
      headline: newHeadline.trim(),
      url: newUrl.trim() || null,
      outlet_name: newOutlet.trim(),
      outlet_tier: 1,
      published_at: today,
      placement_type: 'earned',
      placed_by: '',
      client_id: activeClientId,
      week_id: weekRow.id,
    });

    if (error) {
      toast.error('Failed to add placement.');
      console.error(error);
    } else {
      toast.success('Hit added successfully.');
      setNewOutlet('');
      setNewHeadline('');
      setNewUrl('');
      // Re-fetch
      const weekEnd = new Date(selectedWeek + 'T00:00:00');
      weekEnd.setDate(weekEnd.getDate() + 6);
      const endStr = weekEnd.toISOString().split('T')[0];
      let q = supabase
        .from('placements')
        .select('id, headline, url, outlet_name, outlet_tier, outlet_umv, published_at, placement_type, placed_by')
        .gte('published_at', selectedWeek)
        .lte('published_at', endStr)
        .order('published_at', { ascending: false });
      if (activeClientId) q = q.eq('client_id', activeClientId);
      const { data } = await q;
      setPlacements(data ?? []);
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="bg-card p-4 md:p-5 border border-border space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
            All Press Hits — Running Log
          </h3>
          {!loading && (
            <span className="text-xs font-semibold text-foreground">
              {visible.length} hit{visible.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No placements for this week.</p>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((p) => (
              <div key={p.id} className="flex items-center gap-2 md:gap-3 py-2.5 group">
                <span className="text-xs font-semibold w-28 md:w-36 shrink-0 truncate">{p.outlet_name}</span>
                <button
                  className="text-xs text-primary hover:underline flex-1 text-left truncate"
                  onClick={() => setPreviewItem(p)}
                >
                  {p.headline}
                </button>
                <span className="text-[11px] text-muted-foreground shrink-0 hidden md:inline">
                  {p.published_at ? formatDate(p.published_at) : ''}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0 w-12 text-right">
                  {formatReach(p.outlet_umv)}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline w-24 text-center">
                  {placementLabel(p.placed_by, p.placement_type)}
                </span>
                <span
                  className={`shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 ${tierBg[p.outlet_tier] ?? 'bg-tier1'}`}
                >
                  {tierLabel(p.outlet_tier)}
                </span>
                <button
                  onClick={() => dismiss(p.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Manual entry form */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input
              placeholder="Outlet name"
              value={newOutlet}
              onChange={(e) => setNewOutlet(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Headline or article title"
              value={newHeadline}
              onChange={(e) => setNewHeadline(e.target.value)}
              className="text-xs md:col-span-2"
            />
            <Input
              placeholder="Article URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground max-w-lg">
              Paste any article URL missed by the API — it will appear at the top of the log and open in the article preview.
            </p>
            <Button
              size="sm"
              onClick={handleAddHit}
              disabled={submitting}
              className="text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? 'Adding…' : 'ADD HIT'}
            </Button>
          </div>
        </div>
      </div>

      {/* Slide-in preview panel */}
      <Sheet open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {previewItem && (
            <SheetHeader className="space-y-4">
              <SheetTitle className="text-base leading-snug">{previewItem.headline}</SheetTitle>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">{previewItem.outlet_name}</p>
                {previewItem.published_at && (
                  <p className="text-muted-foreground">{formatDate(previewItem.published_at)}</p>
                )}
                <p className="text-muted-foreground">Reach: {formatReach(previewItem.outlet_umv)}</p>
                <span
                  className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 ${tierBg[previewItem.outlet_tier] ?? 'bg-tier1'}`}
                >
                  {tierLabel(previewItem.outlet_tier)}
                </span>
              </div>
              {previewItem.url && (
                <div className="space-y-3 pt-2">
                  <div className="border border-border rounded overflow-hidden">
                    <iframe
                      src={previewItem.url}
                      title="Article preview"
                      className="w-full h-[50vh]"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs">
                    <a href={previewItem.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in New Tab
                    </a>
                  </Button>
                </div>
              )}
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default PressHitsLog;
