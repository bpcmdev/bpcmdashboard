import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

const PLATFORMS = [
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'perplexity', label: 'Perplexity' },
  { key: 'google_ai', label: 'Google AI' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'claude', label: 'Claude' },
  { key: 'rufus', label: 'Rufus' },
];

interface VisRow {
  platform: string;
  week_start: string;
  visibility_score: number;
  status: string;
}

function cellStyle(status: string) {
  switch (status) {
    case 'strong':
      return 'bg-foreground text-background font-bold';
    case 'needs-work':
      return 'bg-destructive/15 text-destructive font-medium';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const HeatmapView = () => {
  const { activeClientId, refreshKey } = useWeek();
  const [data, setData] = useState<VisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClientId) { setData([]); setLoading(false); return; }
    const fetchAll = async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('ai_visibility')
        .select('platform, week_start, visibility_score, status')
        .eq('client_id', activeClientId)
        .order('week_start', { ascending: true });

      if (error) {
        console.error('Heatmap fetch error:', error);
        setData([]);
      } else {
        setData(rows ?? []);
      }
      setLoading(false);
    };
    fetchAll();
  }, [activeClientId, refreshKey]);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  const weeks = [...new Set(data.map(r => r.week_start))].sort();
  if (weeks.length === 0) {
    return (
      <div className="bg-card border border-border p-5">
        <p className="text-sm text-muted-foreground text-center py-6">No heatmap data available.</p>
      </div>
    );
  }

  const lookup = new Map<string, VisRow>();
  data.forEach(r => lookup.set(`${r.platform}__${r.week_start}`, r));

  return (
    <div className="bg-card border border-border p-5 overflow-x-auto">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Visibility Score Heatmap
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground pb-2 pr-4 w-28">Platform</th>
            {weeks.map(w => (
              <th key={w} className="text-center text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground pb-2 px-1 min-w-[52px]">
                {formatWeekLabel(w)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLATFORMS.map(p => (
            <tr key={p.key}>
              <td className="text-xs font-medium py-1.5 pr-4">{p.label}</td>
              {weeks.map(w => {
                const row = lookup.get(`${p.key}__${w}`);
                return (
                  <td key={w} className="text-center py-1.5 px-1">
                    {row ? (
                      <span className={`inline-block w-10 py-1 text-[11px] ${cellStyle(row.status)}`}>
                        {row.visibility_score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HeatmapView;
