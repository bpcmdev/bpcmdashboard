import { useEffect, useState } from 'react';
import { List, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import PlaceholderCard from './PlaceholderCard';
import DeleteEntryButton from './DeleteEntryButton';
import EditPipelineDialog from './EditPipelineDialog';
import PipelineCalendarView from './PipelineCalendarView';

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
  const { refreshKey, activeClientId: clientId } = useWeek();
  const { isAdmin } = useAdmin();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      setLoading(true);
      setError(false);
      const { data, error: err } = await supabase
        .from('pipeline_moments')
        .select('*')
        .eq('client_id', clientId)
        .order('event_date', { ascending: true });
      if (err) {
        console.error('[PipelineMomentsTab] error:', err);
        setError(true);
      }
      setEntries(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId, refreshKey]);

  const monthGroups = groupByMonth(entries);
  const monitorEntries = entries.filter(e => e.priority && e.monitor_strings?.length > 0);
  const monitorPlaceholders = Math.max(0, 3 - monitorEntries.length);

  return (
    <DataStateWrapper loading={loading} error={error} skeletonCount={4} skeletonHeight="h-20">
      {entries.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground py-24">
          No pipeline moments yet. Add entries via the Admin panel.
        </div>
      ) : (
        <div className="p-6 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">Marketing Calendar</h3>
                <p className="text-[11px] text-muted-foreground">Product launches + cultural moments</p>
              </div>
              <div className="flex items-center bg-muted rounded p-0.5 gap-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Calendar view"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <PipelineCalendarView entries={entries} />
            ) : (
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
                            <p className="text-[10px] text-foreground/80 leading-snug flex-1">{e.title}{e.description ? ` — ${e.description}` : ''}</p>
                            {isAdmin && <EditPipelineDialog entry={e} />}
                            {isAdmin && <DeleteEntryButton table="pipeline_moments" id={e.id} label="this moment" />}
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
            )}
          </div>

          {(monitorEntries.length > 0 || entries.length > 0) && (
            <div>
              <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Agent Intelligence — What to Monitor Now</h3>
              <div className="grid grid-cols-3 gap-4">
                {monitorEntries.map((card) => (
                  <div key={card.id} className="bg-card border border-border p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${dotColors[card.priority] ?? 'bg-muted-foreground'}`} />
                      <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-muted-foreground flex-1">{card.priority}</span>
                      {isAdmin && <EditPipelineDialog entry={card} />}
                      {isAdmin && <DeleteEntryButton table="pipeline_moments" id={card.id} label="this moment" />}
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
                {Array.from({ length: monitorPlaceholders }).map((_, i) => (
                  <PlaceholderCard key={`ph-${i}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DataStateWrapper>
  );
};

export default PipelineMomentsTab;
