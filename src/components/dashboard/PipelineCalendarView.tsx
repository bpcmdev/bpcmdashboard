import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

interface PipelineEntry {
  id: string;
  title: string;
  event_date: string | null;
  event_type: string;
  description: string;
  monitor_strings: string[];
  priority: string;
}

const priorityColors: Record<string, string> = {
  active: 'bg-[hsl(145_63%_42%)]',
  watch: 'bg-[hsl(38_80%_55%)]',
  upcoming: 'bg-muted-foreground',
};

const priorityTextColors: Record<string, string> = {
  active: 'text-[hsl(145_63%_42%)]',
  watch: 'text-[hsl(38_80%_55%)]',
  upcoming: 'text-muted-foreground',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 2;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const PipelineCalendarView = ({ entries }: { entries: PipelineEntry[] }) => {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const goToPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const dateMap = useMemo(() => {
    const map: Record<string, PipelineEntry[]> = {};
    for (const e of entries) {
      if (!e.event_date) continue;
      const d = new Date(e.event_date + 'T00:00:00');
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(e);
      }
    }
    return map;
  }, [entries, viewYear, viewMonth]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goToPrev} className="p-1 hover:bg-muted rounded transition-colors">
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        <h3 className="text-sm font-bold text-foreground tracking-wide">{monthLabel}</h3>
        <button onClick={goToNext} className="p-1 hover:bg-muted rounded transition-colors">
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground text-center py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - firstDay + 1;
          const isValid = dayNum >= 1 && dayNum <= daysInMonth;
          const dayEntries = isValid ? (dateMap[dayNum.toString()] ?? []) : [];
          const isToday = isValid && dayNum === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
          const visible = dayEntries.slice(0, MAX_VISIBLE);
          const extra = dayEntries.length - MAX_VISIBLE;

          return (
            <div
              key={i}
              className={`min-h-[80px] border-b border-r border-border p-1 ${!isValid ? 'bg-muted/30' : ''} ${i % 7 === 0 ? 'border-l' : ''}`}
            >
              {isValid && (
                <>
                  <span className={`text-[10px] font-medium ${isToday ? 'bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center' : 'text-muted-foreground'}`}>
                    {dayNum}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {visible.map(e => (
                      <EventPill key={e.id} entry={e} />
                    ))}
                    {extra > 0 && (
                      <MorePopover entries={dayEntries.slice(MAX_VISIBLE)} count={extra} />
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EventPill = ({ entry }: { entry: PipelineEntry }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="w-full flex items-center gap-1 px-1 py-0.5 rounded hover:bg-muted/60 transition-colors text-left group">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColors[entry.priority] ?? 'bg-muted-foreground'}`} />
        <span className="text-[9px] text-foreground/80 truncate leading-tight">{entry.title}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-64 p-3 pointer-events-auto" side="right" align="start">
      <EventDetail entry={entry} />
    </PopoverContent>
  </Popover>
);

const MorePopover = ({ entries, count }: { entries: PipelineEntry[]; count: number }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1">
        +{count} more
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-64 p-3 pointer-events-auto" side="right" align="start">
      <div className="space-y-3">
        {entries.map(e => (
          <EventDetail key={e.id} entry={e} />
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

const EventDetail = ({ entry }: { entry: PipelineEntry }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1">
      <span className={`w-2 h-2 rounded-full ${priorityColors[entry.priority] ?? 'bg-muted-foreground'}`} />
      <span className={`text-[9px] font-bold tracking-[0.1em] uppercase ${priorityTextColors[entry.priority] ?? 'text-muted-foreground'}`}>
        {entry.priority}
      </span>
    </div>
    <h4 className="text-xs font-bold text-foreground mb-1">{entry.title}</h4>
    <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-muted-foreground">{entry.event_type.replace('-', ' ')}</span>
    {entry.description && (
      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{entry.description}</p>
    )}
    {entry.event_date && (
      <p className="text-[10px] text-muted-foreground mt-1">
        {new Date(entry.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    )}
  </div>
);

export default PipelineCalendarView;
