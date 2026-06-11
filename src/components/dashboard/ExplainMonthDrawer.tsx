import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { RefreshCw } from 'lucide-react';

interface Summary {
  headline: string;
  narrative: string;
  drivers: string[];
  watch_items?: string[];
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName: string | null;
  month: string; // YYYY-MM-01
}

const SUPABASE_URL = 'https://malstqryqfodnqlvrgmn.supabase.co';

function formatMonthLabel(month: string) {
  const d = new Date(month + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const ExplainMonthDrawer = ({ open, onOpenChange, clientId, clientName, month }: Props) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (force = false) => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_id: clientId, month, ...(force ? { force: true } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || json?.message || `Request failed (${res.status})`);
      } else {
        setSummary(json.summary);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [clientId, month]);

  useEffect(() => {
    if (open) fetchSummary(false);
  }, [open, fetchSummary]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-card">
        <SheetHeader>
          <SheetTitle className="text-sm tracking-widest uppercase font-bold">
            {clientName ?? 'Client'} — {formatMonthLabel(month)} Explained
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading && (
            <div className="space-y-3">
              <p className="text-xs tracking-wider uppercase text-muted-foreground">
                Reading the month's numbers…
              </p>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {error && !loading && (
            <div className="border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {summary && !loading && (
            <>
              <h2 className="text-lg font-bold leading-snug">{summary.headline}</h2>
              <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
                {summary.narrative.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {summary.drivers?.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-[11px] tracking-widest uppercase font-bold text-muted-foreground mb-2">
                    What drove it
                  </h3>
                  <ul className="space-y-1.5 text-sm list-disc list-outside pl-5">
                    {summary.drivers.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}

              {summary.watch_items && summary.watch_items.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-[11px] tracking-widest uppercase font-bold text-muted-foreground mb-2">
                    Watch
                  </h3>
                  <ul className="space-y-1.5 text-sm list-disc list-outside pl-5">
                    {summary.watch_items.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-between gap-3">
                <span className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  Generated {relativeTime(summary.created_at)} · AI-drafted, verify before sharing
                </span>
                <button
                  onClick={() => fetchSummary(true)}
                  className="flex items-center gap-1 text-[10px] tracking-widest uppercase font-medium px-2 py-1 border border-border hover:bg-accent transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ExplainMonthDrawer;
