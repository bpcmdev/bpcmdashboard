import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format as formatDate } from 'date-fns';

export const AI_SUMMARY_GOLD = '#C9A961';

export interface AISummaryRow {
  headline: string | null;
  narrative: string | null;
  drivers: string[] | null;
  watch_items: string[] | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
}

const fmtSummaryDate = (v: string | null | undefined) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : formatDate(d, 'MMM d, yyyy');
};
const fmtPeriod = (v: string | null | undefined) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : formatDate(d, 'MMM d');
};

interface AISummarySectionProps {
  clientId: string;
  accent: string;
  isAdmin: boolean;
  kind: string;
  functionName: string;
}

const AISummarySection = ({
  clientId, accent, isAdmin, kind, functionName,
}: AISummarySectionProps) => {
  const [row, setRow] = useState<AISummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmpty(null);
    (async () => {
      try {
        const { data, error: e } = await supabase
          .from('ai_summaries')
          .select('headline, narrative, drivers, watch_items, period_start, period_end, created_at')
          .eq('client_id', clientId)
          .eq('kind', kind)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (e) throw e;
        setRow((data as AISummaryRow) ?? null);
      } catch (err) {
        if (!cancelled) { console.error('ai summary load failed', err); setRow(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, kind]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setEmpty(null);
    try {
      const { data, error: e } = await supabase.functions.invoke(functionName, {
        body: { client_id: clientId },
      });
      if (e) throw e;
      const payload = data as { summary?: AISummaryRow; empty?: boolean; message?: string };
      if (payload?.empty) {
        setEmpty(payload.message || 'No data available yet.');
        setRow(null);
      } else if (payload?.summary) {
        setRow(payload.summary);
      }
    } catch (err) {
      console.error(`${functionName} invoke failed`, err);
      setError('Couldn\u2019t generate summary \u2014 try again');
    } finally {
      setGenerating(false);
    }
  };

  const drivers = (row?.drivers ?? []).filter(Boolean);
  const watch = (row?.watch_items ?? []).filter(Boolean);
  const narrativeParas = (row?.narrative ?? '').split(/\n{2,}/).filter(Boolean);
  const periodLabel = row
    ? [fmtPeriod(row.period_start), fmtPeriod(row.period_end)].filter(Boolean).join(' \u2013 ')
    : '';

  return (
    <section
      className="bg-card border border-black/10 rounded-sm overflow-hidden animate-fade-in"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <span
            className="text-[10px] font-bold tracking-[0.18em] uppercase font-mono-ui"
            style={{ color: accent }}
          >
            AI Summary &amp; Recommendations
          </span>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] tracking-[0.1em] uppercase"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Generating\u2026' : row ? 'Regenerate' : 'Generate'}
            </Button>
          )}
        </div>

        {loading || generating ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : empty ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{empty}</p>
          </div>
        ) : !row ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No AI summary yet for this client.</p>
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {row.headline && (
              <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight tracking-tight text-foreground">
                {row.headline}
              </h2>
            )}
            {narrativeParas.length > 0 && (
              <div className="space-y-3 max-w-3xl">
                {narrativeParas.map((p, i) => (
                  <p key={i} className="text-sm md:text-[15px] leading-relaxed text-foreground/85">
                    {p}
                  </p>
                ))}
              </div>
            )}
            {drivers.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-2 font-mono-ui">
                  Key Drivers
                </h3>
                <ul className="space-y-1.5">
                  {drivers.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <span style={{ color: accent }} className="font-mono mt-0.5">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {watch.length > 0 && (
              <div className="pl-3 border-l-2" style={{ borderColor: AI_SUMMARY_GOLD }}>
                <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2 font-mono-ui" style={{ color: AI_SUMMARY_GOLD }}>
                  Recommendations
                </h3>
                <ul className="space-y-1.5">
                  {watch.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <span style={{ color: AI_SUMMARY_GOLD }} className="font-mono mt-0.5">▲</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground pt-2 border-t border-black/10 font-mono-ui">
              Generated {fmtSummaryDate(row.created_at)}
              {periodLabel ? ` \u00b7 ${periodLabel}` : ''}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
};

export default AISummarySection;
