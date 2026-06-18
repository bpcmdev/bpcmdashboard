import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek, applyWeekStartFilter } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT', perplexity: 'Perplexity', google_ai: 'Google AI',
  gemini: 'Gemini', claude: 'Claude', rufus: 'Rufus',
};

interface PlatformGap { platform: string; score: number; status: string; }
interface SovGap { brand: string; pct: number; rank: number; }

function statusLabel(status: string) {
  switch (status) {
    case 'strong': return { text: 'Strong', style: 'bg-foreground text-background' };
    case 'needs-work': return { text: 'Needs Work', style: 'border border-destructive text-destructive bg-transparent' };
    default: return { text: 'Watch', style: 'bg-muted text-muted-foreground' };
  }
}

const GapAnalysisView = () => {
  const { selectedWeek, activeClientId, refreshKey, weekFilterCtx } = useWeek();
  const { clientName } = useAdmin();
  const [platforms, setPlatforms] = useState<PlatformGap[]>([]);
  const [sovRows, setSovRows] = useState<SovGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClientId) { setPlatforms([]); setSovRows([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      const visQ = applyWeekStartFilter(
        supabase.from('ai_visibility').select('platform, visibility_score, status').eq('client_id', activeClientId),
        weekFilterCtx,
      );
      const sovQ = applyWeekStartFilter(
        supabase.from('competitive_sov').select('brand_name, sov_pct, rank').eq('client_id', activeClientId),
        weekFilterCtx,
      ).order('rank', { ascending: true });
      const [visRes, sovRes] = await Promise.all([visQ, sovQ]);
      if (visRes.error) console.error(visRes.error);
      if (sovRes.error) console.error(sovRes.error);
      setPlatforms((visRes.data ?? []).map(r => ({ platform: r.platform, score: r.visibility_score, status: r.status })));
      setSovRows((sovRes.data ?? []).map(r => ({ brand: r.brand_name, pct: r.sov_pct, rank: r.rank })));
      setLoading(false);
    };
    fetch();
  }, [selectedWeek, activeClientId, refreshKey, weekFilterCtx]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    );
  }

  const lowerClient = (clientName ?? '').toLowerCase();
  const clientSov = sovRows.find(r => r.brand.toLowerCase() === lowerClient);
  const topBrand = sovRows.find(r => r.rank === 1 && r.brand.toLowerCase() !== lowerClient);

  return (
    <div className="space-y-6">
      {/* Platform Gaps */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
          Platform Gap Analysis
        </h3>
        {platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No platform data for this week.</p>
        ) : (
          <div className="space-y-2">
            {platforms.map(p => {
              const s = statusLabel(p.status);
              return (
                <div key={p.platform} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <span className="w-28" style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(225, 70%, 35%)' }}>{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
                  <span className="text-2xl font-bold w-16">{p.score}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
                  <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 ${s.style}`}>{s.text}</span>
                  <span className="text-[11px] text-muted-foreground flex-1">
                    {p.status === 'needs-work' && '⚠ Priority improvement needed'}
                    {p.status === 'moderate' && '👁 Monitor — room for growth'}
                    {p.status === 'strong' && '✓ Performing well'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Competitive SOV Gap */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
          Competitive SOV Gap
        </h3>
        {sovRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No competitive SOV data for this week.</p>
        ) : (
          <div className="space-y-4">
            {clientSov && topBrand && (
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-border p-4">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1">{clientName ?? 'Brand'}</p>
                  <p className="text-3xl font-bold">{clientSov.pct}%</p>
                  <p className="text-[10px] text-muted-foreground">Rank #{clientSov.rank}</p>
                </div>
                <div className="border border-border p-4">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1">{topBrand.brand}</p>
                  <p className="text-3xl font-bold">{topBrand.pct}%</p>
                  <p className="text-[10px] text-muted-foreground">Rank #{topBrand.rank}</p>
                </div>
                <div className="border border-border p-4 flex flex-col justify-center">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1">Gap</p>
                  <p className={`text-3xl font-bold ${(topBrand.pct - clientSov.pct) > 0 ? 'text-destructive' : 'text-positive'}`}>
                    {(topBrand.pct - clientSov.pct) > 0 ? '-' : '+'}{Math.abs(topBrand.pct - clientSov.pct).toFixed(1)} pts
                  </p>
                </div>
              </div>
            )}
            {!clientSov && (
              <p className="text-sm text-muted-foreground text-center py-4">{clientName ?? 'Brand'} not found in competitive SOV data.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GapAnalysisView;
