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
import EmptyState from './EmptyState';

interface PipelineEntry {
  id: string;
  title: string;
  event_date: string | null;
  event_type: string;
  description: string;
  monitor_strings: string[];
  priority: string;
}

const dotStyles: Record<string, React.CSSProperties> = {
  active:   { background: '#047857', boxShadow: '0 0 6px rgba(4,120,87,0.45)' },
  watch:    { background: 'hsl(42 64% 45%)', boxShadow: '0 0 6px rgba(201,160,60,0.4)' },
  upcoming: { background: 'rgba(0,0,0,0.4)' },
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

type PriorityFilter = 'ALL' | 'ACTIVE' | 'WATCH' | 'UPCOMING';

const PipelineMomentsTab = () => {
  const { refreshKey, activeClientId: clientId } = useWeek();
  const { isAdmin } = useAdmin();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const filteredEntries = priorityFilter === 'ALL'
    ? entries
    : entries.filter(e => (e.priority || '').toLowerCase() === priorityFilter.toLowerCase());

  const monthGroups = groupByMonth(filteredEntries);
  const monitorEntries = filteredEntries.filter(e => e.priority && e.monitor_strings?.length > 0);
  const monitorPlaceholders = Math.max(0, 3 - monitorEntries.length);

  return (
    <DataStateWrapper loading={loading} error={error} skeletonCount={4} skeletonHeight="h-20">
      {entries.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No pipeline moments yet"
          description="Add entries via the Admin panel or upload a weekly document."
        />
      ) : (
        <div className="p-6 space-y-8">
          {/* Priority filter chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(['ALL', 'ACTIVE', 'WATCH', 'UPCOMING'] as PriorityFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '5px 12px',
                  border: priorityFilter === p ? '1px solid rgba(201,160,60,0.5)' : '1px solid rgba(0,0,0,0.1)',
                  background: priorityFilter === p ? 'rgba(201,160,60,0.12)' : 'transparent',
                  color: priorityFilter === p ? 'hsl(42 64% 38%)' : 'hsl(0 0% 40%)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="section-label">Marketing Calendar</span>
                <p className="text-[11px] text-muted-foreground mt-1">Product launches + cultural moments</p>
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
              <PipelineCalendarView entries={filteredEntries} />
            ) : (
            <div className="overflow-x-auto bg-card border border-black/10">
              <div className="flex min-w-[900px]">
                {Object.entries(monthGroups).map(([month, items]) => (
                  <div key={month} className="flex-1 min-w-[170px] border-r border-black/10 p-3 pb-4">
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground mb-3">{month}</p>
                    <div className="space-y-3">
                      {items.map((e) => (
                        <div key={e.id} className="flex flex-col gap-1.5 pb-1">
                          <div className="flex items-start gap-1.5">
                            <span className="text-muted-foreground mt-0.5">●</span>
                            <p className="text-[10px] text-foreground/80 leading-snug flex-1">{e.title}{e.description ? ` — ${e.description}` : ''}</p>
                            {isAdmin && <EditPipelineDialog entry={e} />}
                            {isAdmin && <DeleteEntryButton table="pipeline_moments" id={e.id} label="this moment" />}
                          </div>
                          <span className={`self-start inline-flex items-center text-[8px] font-bold tracking-[0.1em] uppercase leading-none px-1.5 py-1 ${badgeStyles[e.event_type] ?? 'bg-muted text-muted-foreground'}`}>
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

          {(monitorEntries.length > 0 || filteredEntries.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="section-label">Agent Intelligence — What to Monitor Now</span>
                <span className="section-count">{monitorEntries.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {monitorEntries.map((card) => {
                  const desc = card.description ?? '';
                  const isLong = desc.length > 120;
                  const isOpen = !!expanded[card.id];
                  const showDesc = isLong && !isOpen ? desc.slice(0, 120).trim() + '…' : desc;
                  return (
                  <div key={card.id} className="entry-card cat-default bg-card border border-black/10 p-5 relative cursor-pointer">
                    <span
                      className="absolute top-3 left-3 inline-block rounded-full"
                      style={{ width: 8, height: 8, ...(dotStyles[card.priority] ?? dotStyles.upcoming) }}
                    />
                    <div className="flex items-center gap-2 mb-3 pl-5">
                      <span className="font-mono-ui text-[9px] font-medium tracking-[0.18em] uppercase text-muted-foreground flex-1">{card.priority}</span>
                      {isAdmin && <EditPipelineDialog entry={card} />}
                      {isAdmin && <DeleteEntryButton table="pipeline_moments" id={card.id} label="this moment" />}
                    </div>
                    <h4 className="text-sm font-bold text-foreground mb-2">{card.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{showDesc}</p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setExpanded(prev => ({ ...prev, [card.id]: !isOpen }))}
                        className="text-[11px] font-medium mb-3"
                        style={{ color: 'hsl(225,70%,35%)' }}
                      >
                        {isOpen ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    {card.monitor_strings?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {card.monitor_strings.map((m, j) => (
                          <span key={j} className="text-[9px] bg-muted px-1.5 py-0.5 text-muted-foreground">"{m}"</span>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
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
