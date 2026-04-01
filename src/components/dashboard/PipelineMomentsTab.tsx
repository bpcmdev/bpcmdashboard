import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';

interface PipelineEntry {
  id: string;
  title: string;
  event_date: string | null;
  event_type: string;
  description: string;
  monitor_strings: string[];
  priority: string;
}

const dotColors: Record<string, string> = {
  active: 'bg-[hsl(145_63%_42%)]',
  watch: 'bg-[hsl(38_80%_55%)]',
  upcoming: 'bg-muted-foreground',
};

const badgeStyles: Record<string, string> = {
  launch: 'bg-foreground text-background',
  event: 'bg-muted-foreground/70 text-background',
  'corp-comms': 'bg-foreground text-background',
  milestone: 'bg-[hsl(80_30%_35%)] text-background',
  moment: 'bg-[hsl(80_30%_35%)] text-background',
  retail: 'bg-muted-foreground/70 text-background',
};

function groupByMonth(entries: PipelineEntry[]) {
  const groups: Record<string, PipelineEntry[]> = {};
  for (const e of entries) {
    if (!e.event_date) continue;
    const d = new Date(e.event_date + 'T00:00:00');
    const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

const PipelineMomentsTab = () => {
  const { clientId } = useAdmin();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('pipeline_moments')
        .select('*')
        .eq('client_id', clientId)
        .order('event_date', { ascending: true });
      if (error) console.error('[PipelineMomentsTab] error:', error);
      setEntries(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const monthGroups = groupByMonth(entries);
  const monitorEntries = entries.filter(e => e.priority && e.monitor_strings?.length > 0);

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground py-24">
        No pipeline moments yet. Add entries via the Admin panel.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Calendar */}
      <div>
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">Marketing Calendar</h3>
        <p className="text-[11px] text-muted-foreground mb-4">Product launches + cultural moments</p>
        <div className="overflow-x-auto">
          <div className="flex min-w-[900px]">
            {Object.entries(monthGroups).map(([month, items]) => (
              <div key={month} className="flex-1 min-w-[170px] border-r border-border p-3">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground mb-3">{month}</p>
                <div className="space-y-2">
                  {items.map((e) => (
                    <div key={e.id} className="flex flex-col gap-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-muted-foreground mt-0.5">●</span>
                        <p className="text-[10px] text-foreground/80 leading-snug">{e.title}{e.description ? ` — ${e.description}` : ''}</p>
                      </div>
                      <span className={`self-start text-[8px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 ${badgeStyles[e.event_type] ?? 'bg-muted text-muted-foreground'}`}>
                        {e.event_type.replace('-', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monitor Cards */}
      {monitorEntries.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Agent Intelligence — What to Monitor Now</h3>
          <div className="grid grid-cols-3 gap-4">
            {monitorEntries.map((card) => (
              <div key={card.id} className="bg-card border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${dotColors[card.priority] ?? 'bg-muted-foreground'}`} />
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground">{card.priority}</span>
                </div>
                <h4 className="text-sm font-bold text-foreground mb-2">{card.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{card.description}</p>
                {card.monitor_strings?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {card.monitor_strings.map((m, j) => (
                      <span key={j} className="text-[9px] bg-muted px-1.5 py-0.5 text-muted-foreground">"{m}"</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineMomentsTab;
