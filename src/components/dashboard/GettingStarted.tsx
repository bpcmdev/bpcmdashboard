import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';

interface GettingStartedProps {
  onDismiss: () => void;
  onJumpToTab: (tab: string) => void;
  onOpenAdmin: () => void;
}

interface ChecklistState {
  hasPlacements: boolean;
  hasKeyWins: boolean;
  hasPipeline: boolean;
  hasSnapshot: boolean;
  hasTeam: boolean;
}

/**
 * Returns true when the current client is "new" (no real data yet).
 * Returns null while still loading, false when normal dashboard should render.
 */
export function useIsNewClient(): { isNew: boolean | null; checklist: ChecklistState | null; refresh: () => void } {
  const { activeClientId, refreshKey } = useWeek();
  const [isNew, setIsNew] = useState<boolean | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeClientId) {
      setIsNew(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const [snap, kw, pl, pm, users] = await Promise.all([
        supabase.from('weekly_snapshots').select('placement_count').eq('client_id', activeClientId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('key_wins').select('id', { count: 'exact', head: true }).eq('client_id', activeClientId),
        supabase.from('placements').select('id', { count: 'exact', head: true }).eq('client_id', activeClientId),
        supabase.from('pipeline_moments').select('id', { count: 'exact', head: true }).eq('client_id', activeClientId),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('client_id', activeClientId),
      ]);
      if (cancelled) return;

      const placementsCount = pl.count ?? 0;
      const keyWinsCount = kw.count ?? 0;
      const pipelineCount = pm.count ?? 0;
      const usersCount = users.count ?? 0;
      const latestPlacementCount = snap.data?.placement_count ?? 0;

      const cs: ChecklistState = {
        hasPlacements: placementsCount > 0,
        hasKeyWins: keyWinsCount > 0,
        hasPipeline: pipelineCount > 0,
        hasSnapshot: !!snap.data && latestPlacementCount > 0,
        hasTeam: usersCount > 1,
      };
      setChecklist(cs);

      const newish = latestPlacementCount === 0 && placementsCount === 0 && keyWinsCount === 0 && pipelineCount === 0;
      setIsNew(newish);
    };
    check();
    return () => { cancelled = true; };
  }, [activeClientId, refreshKey, tick]);

  return { isNew, checklist, refresh: () => setTick(t => t + 1) };
}

const GettingStarted = ({ onDismiss, onJumpToTab, onOpenAdmin }: GettingStartedProps) => {
  const { isNew, checklist } = useIsNewClient();
  const { isAdmin, clientName } = useAdmin();

  if (isNew === null || !checklist) {
    return (
      <div className="px-6 md:px-10 py-12 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  type Item = { done: boolean; label: string; cta: string; onClick: () => void; adminOnly?: boolean };
  const items: Item[] = [
    { done: true, label: 'Dashboard created', cta: '', onClick: () => {} },
    { done: checklist.hasPlacements, label: 'First placements added', cta: 'Go to Earned Media', onClick: () => onJumpToTab('EARNED MEDIA') },
    { done: checklist.hasKeyWins, label: 'Key wins entered', cta: 'Go to Key Wins', onClick: () => onJumpToTab('KEY WINS') },
    { done: checklist.hasPipeline, label: 'Pipeline moments added', cta: 'Go to Pipeline & Moments', onClick: () => onJumpToTab('PIPELINE & MOMENTS') },
    { done: checklist.hasSnapshot, label: 'Weekly snapshot updated', cta: 'Open Admin Panel', onClick: onOpenAdmin, adminOnly: true },
    { done: checklist.hasTeam, label: 'Team invited', cta: 'Open Admin Panel', onClick: onOpenAdmin, adminOnly: true },
  ];

  const visible = items.filter(it => !it.adminOnly || isAdmin);

  return (
    <div className="px-6 md:px-10 py-12 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-[0.18em]">BPCM</h1>
        <p className="text-[11px] tracking-[0.22em] uppercase mt-2 text-muted-foreground">Intelligence Platform</p>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
          Welcome to your Intelligence Dashboard
        </h2>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl">
          {clientName ? `${clientName}, you’re` : 'You’re'} just a few steps away from a fully-populated dashboard.
          Complete the checklist below to bring your data online.
        </p>
      </div>

      <div className="border border-border bg-card divide-y divide-border">
        {visible.map((it, i) => (
          <div key={i} className="flex items-center gap-4 px-4 md:px-5 py-4">
            {it.done ? (
              <CheckCircle2 className="h-5 w-5 text-positive shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <span className={`flex-1 text-sm ${it.done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
              {it.label}
            </span>
            {!it.done && it.cta && (
              <button
                onClick={it.onClick}
                className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.15em] uppercase text-foreground hover:underline"
              >
                {it.cta} <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground tracking-wider uppercase">
          {visible.filter(i => i.done).length} of {visible.length} complete
        </p>
        <button
          onClick={onDismiss}
          className="text-[11px] font-bold tracking-[0.15em] uppercase px-4 py-2 border border-border hover:bg-accent transition-colors"
        >
          View Empty Dashboard
        </button>
      </div>
    </div>
  );
};

export default GettingStarted;
