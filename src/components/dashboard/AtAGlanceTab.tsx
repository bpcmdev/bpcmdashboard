import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DataStateWrapper from './DataStateWrapper';
import PlaceholderCard from './PlaceholderCard';

/* ─────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────── */
interface GlanceCard {
  id: string;
  category: string | null;
  headline: string;
  body: string | null;
  stat_line: string | null;
  featured: boolean | null;
  sort_order: number | null;
  week_start: string | null;
}

interface TagRow {
  id: string;
  name: string;
  color: string | null;
}

interface AssetRow {
  id: string;
  launch: string;
  target_date: string | null;
  status: 'received' | 'due_soon' | 'urgent' | string;
  assets_needed: string | null;
  notes: string | null;
  owner_name: string | null;
  tags: TagRow[] | null;
  updated_at?: string | null;
}

interface PipelineMoment {
  id: string;
  title: string;
  event_date: string | null;
  event_type: string;
  description: string | null;
  monitor_strings: unknown;
  priority: string | null;
}

interface ProductRow {
  id: string;
  product_name: string;
  launch_date: string | null;
  launch_type: string | null;
  description: string | null;
}

interface AgentIntelRow {
  category: string;
  headline: string;
  body: string | null;
  stat_line: string | null;
  confidence: string | null;
  generated_at: string | null;
}

const toArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    if (v.startsWith('[')) { try { return JSON.parse(v); } catch { /* ignore */ } }
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

/* ─────────────────────────────────────────────────────────────────
   Section header — Playfair Display
   ───────────────────────────────────────────────────────────────── */
const SectionHeader = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="mb-5">
    <div className="flex items-center gap-2 mb-2">
      <span className="h-px w-6 bg-foreground/40" />
      <span className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">{eyebrow}</span>
    </div>
    <h2 className="font-display text-[28px] md:text-[34px] leading-tight tracking-tight text-foreground">{title}</h2>
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   Brand Momentum Snapshot
   ───────────────────────────────────────────────────────────────── */
function GlanceCardTile({ card, index = 0 }: { card: GlanceCard; index?: number }) {
  const isDark = !!card.featured;
  return (
    <div
      className={[
        'stagger-in rounded-lg p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)]',
        isDark
          ? 'bg-foreground text-background border border-foreground'
          : 'section-card text-foreground border',
      ].join(' ')}
      style={{
        '--stagger-delay': `${Math.min(index * 40, 400)}ms`,
        ...(isDark ? { boxShadow: '0 1px 0 rgba(0,0,0,0.04)' } : {}),
      } as React.CSSProperties}
    >
      {card.category && (
        <span
          className={[
            'inline-block px-2 py-0.5 mb-3 text-[9px] font-mono-ui tracking-[0.16em] uppercase rounded-full',
            isDark ? 'bg-background/15 text-background' : 'bg-black/5 text-foreground/70',
          ].join(' ')}
        >
          {card.category}
        </span>
      )}
      <h3 className={['font-display text-[20px] leading-snug mb-2', isDark ? 'text-background' : 'text-foreground'].join(' ')}>
        {card.headline}
      </h3>
      {card.body && (
        <p className={['text-[13px] leading-relaxed mb-3', isDark ? 'text-background/85' : 'text-foreground/75'].join(' ')}>
          {card.body}
        </p>
      )}
      {card.stat_line && (
        <div className={['pt-3 border-t font-mono-ui text-[11px] tracking-wider', isDark ? 'border-background/20 text-background/90' : 'border-black/10 text-foreground/70'].join(' ')}>
          {card.stat_line}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Asset Tracker
   ───────────────────────────────────────────────────────────────── */
type SortKey = 'launch' | 'target_date' | 'status' | 'owner_name';
const statusOrder: Record<string, number> = { urgent: 0, due_soon: 1, received: 2 };

const STATUS_OPTIONS = ['urgent', 'due_soon', 'received'] as const;

const statusMap: Record<string, { label: string; cls: string }> = {
  received: { label: 'Received',   cls: 'bg-[hsl(145_63%_42%/0.15)] text-[hsl(145_63%_28%)] border border-[hsl(145_63%_42%/0.35)]' },
  due_soon: { label: 'Due soon',   cls: 'bg-[hsl(42_85%_50%/0.18)]  text-[hsl(36_75%_30%)] border border-[hsl(42_85%_50%/0.4)]' },
  urgent:   { label: 'Urgent',     cls: 'bg-[hsl(0_75%_55%/0.15)]   text-[hsl(0_75%_38%)]  border border-[hsl(0_75%_55%/0.35)]' },
};

function StatusChip({ status }: { status: string }) {
  const m = statusMap[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border border-border' };
  return <span className={`inline-block px-2 py-0.5 text-[10px] font-mono-ui tracking-wider uppercase rounded-full ${m.cls}`}>{m.label}</span>;
}

function StatusEditor({ row, onChange }: { row: AssetRow; onChange: (status: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="focus:outline-none hover:opacity-80 transition-opacity">
          <StatusChip status={row.status} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-40 p-1">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => { setOpen(false); if (s !== row.status) onChange(s); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-black/5 text-left"
          >
            <StatusChip status={s} />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TagPill({ tag }: { tag: TagRow }) {
  const color = tag.color || '#6b7280';
  return (
    <span
      className="inline-block px-2 py-0.5 text-[10px] font-mono-ui tracking-wider uppercase rounded-full border"
      style={{ backgroundColor: `${color}22`, borderColor: `${color}55`, color }}
    >
      {tag.name}
    </span>
  );
}

function TagEditor({
  row,
  availableTags,
  onToggle,
}: { row: AssetRow; availableTags: TagRow[]; onToggle: (tag: TagRow, active: boolean) => void }) {
  const active = new Set((row.tags ?? []).map(t => t.id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground">
          Edit
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-2">Tags</div>
        {availableTags.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No tags configured.</p>
        ) : (
          <div className="space-y-1">
            {availableTags.map(t => (
              <button
                key={t.id}
                onClick={() => onToggle(t, active.has(t.id))}
                className="w-full flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-black/5"
              >
                <TagPill tag={t} />
                <span className="text-[11px] text-muted-foreground">{active.has(t.id) ? '✓' : '+'}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AssetTracker({
  rows,
  isAdmin,
  availableTags,
  onStatusChange,
  onTagToggle,
}: {
  rows: AssetRow[];
  isAdmin: boolean;
  availableTags: TagRow[];
  onStatusChange: (row: AssetRow, status: string) => void;
  onTagToggle: (row: AssetRow, tag: TagRow, active: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('target_date');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'launch')      { av = a.launch ?? ''; bv = b.launch ?? ''; }
      if (sortKey === 'target_date') { av = a.target_date ?? '9999-12-31'; bv = b.target_date ?? '9999-12-31'; }
      if (sortKey === 'status')      { av = statusOrder[a.status] ?? 99; bv = statusOrder[b.status] ?? 99; }
      if (sortKey === 'owner_name')  { av = (a.owner_name ?? 'zzz').toLowerCase(); bv = (b.owner_name ?? 'zzz').toLowerCase(); }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc(v => !v);
    else { setSortKey(k); setAsc(true); }
  };

  const Th = ({ k, children, className = '' }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      onClick={k ? () => toggle(k) : undefined}
      className={`text-left font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground py-3 px-4 ${k ? 'cursor-pointer select-none hover:text-foreground' : ''} ${className}`}
    >
      {children}{k && sortKey === k && <span className="ml-1 text-foreground/60">{asc ? '↑' : '↓'}</span>}
    </th>
  );

  if (!rows.length) return <PlaceholderCard />;

  return (
    <div className="bg-white border border-black/10 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-black/[0.02]">
            <tr>
              <Th k="launch">Launch</Th>
              <Th k="target_date">Target Date</Th>
              <Th k="status">Status</Th>
              <Th k="owner_name">Owner</Th>
              <Th>Tags</Th>
              <Th>Assets Needed</Th>
              <Th>Notes</Th>
              {isAdmin && <Th className="text-right"> </Th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} className={i % 2 ? 'bg-black/[0.015]' : ''}>
                <td className="px-4 py-3 font-medium text-foreground">{r.launch}</td>
                <td className="px-4 py-3 font-mono-ui text-[12px] tracking-wider text-foreground/80">
                  {r.target_date ? new Date(r.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3">
                  {isAdmin
                    ? <StatusEditor row={r} onChange={s => onStatusChange(r, s)} />
                    : <StatusChip status={r.status} />}
                </td>
                <td className="px-4 py-3 text-foreground/80">
                  {r.owner_name || <span className="text-muted-foreground">Unassigned</span>}
                </td>
                <td className="px-4 py-3">
                  {(r.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).map(t => <TagPill key={t.id} tag={t} />)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground/80">{r.assets_needed || '—'}</td>
                <td className="px-4 py-3 text-foreground/60 text-[13px]">{r.notes || '—'}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <TagEditor row={r} availableTags={availableTags} onToggle={(t, a) => onTagToggle(r, t, a)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Agent Intelligence — AI-generated category cards
   ───────────────────────────────────────────────────────────────── */
const AGENT_CATEGORY_ORDER = ['trend', 'global', 'active', 'prepare', 'watch', 'sov'] as const;

const AGENT_CATEGORY_COLOR: Record<string, string> = {
  trend:   'hsl(217 75% 50%)',   // blue
  global:  'hsl(178 60% 38%)',   // teal
  active:  'hsl(145 63% 38%)',   // green
  prepare: 'hsl(42 85% 48%)',    // amber
  watch:   'hsl(0 75% 50%)',     // red
  sov:     'hsl(272 55% 50%)',   // purple
};

function AgentIntelCard({ row, index = 0 }: { row: AgentIntelRow; index?: number }) {
  const accent = AGENT_CATEGORY_COLOR[row.category] ?? 'rgba(0,0,0,0.25)';
  const limited = row.confidence === 'limited';
  return (
    <div
      className="stagger-in section-card border rounded-lg p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)]"
      style={{
        borderLeft: `4px solid ${accent}`,
        borderLeftColor: accent,
        opacity: limited ? 0.85 : 1,
        '--stagger-delay': `${Math.min(index * 40, 400)}ms`,
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-mono-ui text-[10px] tracking-[0.18em] uppercase"
          style={{ color: accent, opacity: limited ? 0.5 : 1 }}
        >
          {row.category}
        </span>
        {limited && (
          <span className="px-1.5 py-0.5 rounded-full bg-black/5 font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground">
            Limited data
          </span>
        )}
      </div>
      <h3 className={`font-display text-[18px] leading-snug mb-1.5 ${limited ? 'text-foreground/60' : 'text-foreground'}`}>
        {row.headline}
      </h3>
      {row.body && (
        <p className={`text-[13px] leading-relaxed ${limited ? 'text-foreground/50' : 'text-foreground/75'} ${row.stat_line ? 'mb-3' : ''}`}>
          {row.body}
        </p>
      )}
      {row.stat_line && (
        <div className={`pt-3 border-t border-black/10 font-mono-ui text-[10px] tracking-[0.18em] uppercase ${limited ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
          {row.stat_line}
        </div>
      )}
    </div>
  );
}

function AgentIntelligenceSection({ clientId }: { clientId: string | null }) {
  const { isAdmin } = useAdmin();
  const [rows, setRows] = useState<AgentIntelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) { setRows([]); setLoading(false); return; }
    const { data, error } = await supabase.rpc('agent_intelligence_latest', { p_client_id: clientId });
    if (error) console.error('[AgentIntelligence] load failed', error);
    setRows(((data as AgentIntelRow[]) ?? []));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const ordered = useMemo(() => {
    const idx = (c: string) => {
      const i = AGENT_CATEGORY_ORDER.indexOf(c as typeof AGENT_CATEGORY_ORDER[number]);
      return i === -1 ? 99 : i;
    };
    return [...rows].sort((a, b) => idx(a.category) - idx(b.category));
  }, [rows]);

  const newest = useMemo(() => {
    const ts = rows.map(r => r.generated_at).filter(Boolean) as string[];
    if (!ts.length) return null;
    return new Date(ts.sort().reverse()[0]);
  }, [rows]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke('agent-intelligence', {
      body: { client_id: clientId },
    });
    if (error || (data && (data as { error?: string }).error)) {
      setErrorMsg((data as { error?: string })?.error || error?.message || 'Failed to regenerate.');
      setRegenerating(false);
      return;
    }
    await load();
    setRegenerating(false);
  };

  if (loading) return null;
  if (!ordered.length && !isAdmin) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-foreground/40" />
            <span className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Agent Intelligence</span>
          </div>
          <h2 className="font-display text-[28px] md:text-[34px] leading-tight tracking-tight text-foreground">What we're watching</h2>
        </div>
        {isAdmin && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-1.5 font-mono-ui text-[10px] font-semibold tracking-[0.1em] uppercase border border-foreground/30 text-foreground/80 hover:bg-foreground hover:text-background transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenerating ? 'Analyzing…' : ordered.length ? 'Regenerate' : 'Generate'}
          </button>
        )}
      </div>

      {errorMsg && <p className="text-sm text-destructive mb-4">{errorMsg}</p>}

      {ordered.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ordered.map(r => <AgentIntelCard key={r.category} row={r} />)}
          </div>
          {newest && (
            <div className="mt-3 font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
              Generated {newest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Marketing Calendar — quarter grouping
   ───────────────────────────────────────────────────────────────── */
type CalendarEntry = {
  id: string;
  title: string;
  description: string | null;
  badge: string;
  date: string; // ISO
  kind: 'pipeline' | 'product';
};

const SEASON_NAMES = ['Winter', 'Spring', 'Summer', 'Fall'];

function seasonKey(dateStr: string): { key: string; sortKey: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth(); // 0-11
  const season = SEASON_NAMES[Math.floor(month / 3)];
  const year = d.getFullYear();
  return {
    key: `${season} ${year}`,
    sortKey: `${year}-${String(Math.floor(month / 3)).padStart(2, '0')}`,
  };
}

function MarketingCalendar({
  moments,
  products,
}: { moments: PipelineMoment[]; products: ProductRow[] }) {
  const groups = useMemo(() => {
    const all: (CalendarEntry & { sortKey: string })[] = [];
    moments.forEach(m => {
      if (!m.event_date) return;
      const { key, sortKey } = seasonKey(m.event_date);
      all.push({
        id: `m-${m.id}`,
        title: m.title,
        description: m.description,
        badge: m.event_type,
        date: m.event_date,
        kind: 'pipeline',
        sortKey: `${sortKey}|${key}`,
      });
    });
    products.forEach(p => {
      if (!p.launch_date) return;
      const { key, sortKey } = seasonKey(p.launch_date);
      all.push({
        id: `p-${p.id}`,
        title: p.product_name,
        description: p.description,
        badge: p.launch_type || 'launch',
        date: p.launch_date,
        kind: 'product',
        sortKey: `${sortKey}|${key}`,
      });
    });
    const byKey = new Map<string, { label: string; sortKey: string; entries: CalendarEntry[] }>();
    all.forEach(e => {
      const [sk, label] = e.sortKey.split('|');
      const existing = byKey.get(label) ?? { label, sortKey: sk, entries: [] };
      existing.entries.push(e);
      byKey.set(label, existing);
    });
    const arr = Array.from(byKey.values());
    arr.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    arr.forEach(g => g.entries.sort((a, b) => a.date.localeCompare(b.date)));
    return arr;
  }, [moments, products]);

  const allEntries = useMemo(() => groups.flatMap(g => g.entries), [groups]);
  const [calendarView, setCalendarView] = useState<'list' | 'calendar'>('list');

  if (!groups.length) return <PlaceholderCard />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="inline-flex border border-foreground/20 rounded overflow-hidden">
          {(['list', 'calendar'] as const).map(v => (
            <button
              key={v}
              onClick={() => setCalendarView(v)}
              className={`px-3 py-1.5 font-mono-ui text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${
                calendarView === v
                  ? 'bg-foreground text-background'
                  : 'text-foreground/70 hover:bg-black/5'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {calendarView === 'list' ? (
        <div className="overflow-x-auto -mx-6 px-6 pb-2">
          <div className="flex gap-5 min-w-min">
            {groups.map(g => (
              <div key={g.label} className="flex-shrink-0 w-[280px]">
                <div className="mb-3 pb-2 border-b-2 border-foreground/80">
                  <h3 className="font-display text-[20px] leading-none text-foreground">{g.label}</h3>
                  <div className="mt-1 font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                    {g.entries.length} {g.entries.length === 1 ? 'entry' : 'entries'}
                  </div>
                </div>
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {g.entries.map(e => <CalendarEntryCard key={e.id} entry={e} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <MonthGrid entries={allEntries} />
      )}
    </div>
  );
}

function CalendarEntryCard({ entry: e }: { entry: CalendarEntry }) {
  return (
    <div className="bg-white border border-black/10 rounded-md p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/70 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[14px] text-foreground leading-snug">{e.title}</div>
          {e.description && (
            <p className="text-[12px] text-foreground/65 leading-snug mt-0.5 line-clamp-1">{e.description}</p>
          )}
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 text-[9px] font-mono-ui tracking-[0.16em] uppercase rounded-full bg-black/5 text-foreground/75">
              {e.badge}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MonthGrid({ entries }: { entries: CalendarEntry[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    entries.forEach(e => {
      const key = e.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return map;
  }, [entries]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const shift = (n: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const todayKey = isoDay(today);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-[20px] leading-none text-foreground">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          {[['‹', -1], ['Today', 0], ['›', 1]].map(([label, n]) => (
            <button
              key={String(label)}
              onClick={() => (n === 0 ? setCursor(new Date(today.getFullYear(), today.getMonth(), 1)) : shift(n as number))}
              className="px-2.5 py-1 font-mono-ui text-[10px] font-semibold tracking-[0.1em] uppercase border border-foreground/20 text-foreground/75 hover:bg-black/5 rounded"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-black/10">
        {DOW.map(d => (
          <div key={d} className="border-r border-b border-black/10 px-2 py-1.5 font-mono-ui text-[10px] tracking-[0.16em] uppercase text-muted-foreground bg-black/[0.02]">
            {d}
          </div>
        ))}
        {days.map(d => {
          const key = isoDay(d);
          const dayEntries = byDay.get(key) ?? [];
          const outside = d.getMonth() !== cursor.getMonth();
          return (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <div
                  className={`border-r border-b border-black/10 min-h-[92px] p-1.5 text-left align-top cursor-pointer hover:bg-black/[0.03] transition-colors ${
                    outside ? 'bg-black/[0.02] text-foreground/35' : ''
                  }`}
                >
                  <div className={`font-mono-ui text-[10px] mb-1 ${key === todayKey ? 'font-bold text-foreground' : 'text-foreground/60'}`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEntries.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded bg-black/5"
                        title={e.title}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/70 flex-shrink-0" />
                        <span className="truncate text-[10px] text-foreground/80">{e.title}</span>
                      </div>
                    ))}
                    {dayEntries.length > 2 && (
                      <div className="font-mono-ui text-[9px] tracking-[0.12em] uppercase text-muted-foreground pl-1">
                        +{dayEntries.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              </PopoverTrigger>
              {dayEntries.length > 0 && (
                <PopoverContent align="start" className="w-[300px] p-3 max-h-[360px] overflow-y-auto">
                  <div className="font-mono-ui text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-2">
                    {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="space-y-3">
                    {dayEntries.map(e => <CalendarEntryCard key={e.id} entry={e} />)}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Tab root
   ───────────────────────────────────────────────────────────────── */
const AtAGlanceTab = () => {
  const { activeClientId: clientId, selectedWeek, isAllTime, isYTD, ytdFrom, refreshKey } = useWeek();
  const { isAdmin } = useAdmin();

  const [cards, setCards]       = useState<GlanceCard[]>([]);
  const [assets, setAssets]     = useState<AssetRow[]>([]);
  const [clientTags, setClientTags] = useState<TagRow[]>([]);
  const [moments, setMoments]   = useState<PipelineMoment[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [assetKey, setAssetKey] = useState(0);

  const reloadAssets = useCallback(async () => {
    if (!clientId) return;
    const { data, error: err } = await supabase.rpc('assets_list', { p_client_id: clientId });
    if (err) { console.error('[AtAGlance] assets_list failed', err); return; }
    setAssets((data as AssetRow[]) ?? []);
  }, [clientId]);

  const handleStatusChange = useCallback(async (row: AssetRow, status: string) => {
    const { error: err } = await supabase.from('asset_tracker').update({ status }).eq('id', row.id);
    if (err) { console.error('[AtAGlance] status update failed', err); return; }
    await reloadAssets();
  }, [reloadAssets]);

  const handleTagToggle = useCallback(async (row: AssetRow, tag: TagRow, active: boolean) => {
    if (active) {
      const { error: err } = await supabase
        .from('entity_tags')
        .delete()
        .eq('entity_type', 'asset')
        .eq('entity_id', row.id)
        .eq('tag_id', tag.id);
      if (err) { console.error('[AtAGlance] tag remove failed', err); return; }
    } else {
      const { error: err } = await supabase
        .from('entity_tags')
        .insert({ entity_type: 'asset', entity_id: row.id, tag_id: tag.id, client_id: clientId });
      if (err) { console.error('[AtAGlance] tag add failed', err); return; }
    }
    await reloadAssets();
  }, [clientId, reloadAssets]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const glancePromise = (async () => {
          const { data: latest } = await supabase
            .from('glance_cards')
            .select('week_start')
            .eq('client_id', clientId)
            .order('week_start', { ascending: false })
            .limit(1)
            .single();
          if (!latest?.week_start) return { data: [], error: null };
          return supabase
            .from('glance_cards')
            .select('*')
            .eq('client_id', clientId)
            .eq('week_start', latest.week_start)
            .order('sort_order', { ascending: true });
        })();
        const assetsPromise   = supabase.rpc('assets_list', { p_client_id: clientId });
        const tagsPromise     = supabase.from('client_tags').select('id, name, color').eq('client_id', clientId);
        const momentsPromise  = supabase.from('pipeline_moments').select('*').eq('client_id', clientId).order('event_date', { ascending: true });
        const productsPromise = supabase.from('product_pipeline').select('*').eq('client_id', clientId).order('launch_date', { ascending: true });

        const [g, a, t, m, p] = await Promise.all([glancePromise, assetsPromise, tagsPromise, momentsPromise, productsPromise]);
        if (cancelled) return;
        if (g.error || a.error || m.error || p.error) {
          console.error('[AtAGlance] load error', { g: g.error, a: a.error, m: m.error, p: p.error });
          setError(true);
        } else {
          setCards((g.data ?? []) as GlanceCard[]);
          setAssets((a.data ?? []) as AssetRow[]);
          setClientTags((t.data ?? []) as TagRow[]);
          setMoments((m.data ?? []) as PipelineMoment[]);
          setProducts((p.data ?? []) as ProductRow[]);
        }
      } catch (e) {
        if (!cancelled) { console.error(e); setError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [clientId, selectedWeek, isAllTime, isYTD, ytdFrom, refreshKey, assetKey]);

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [cards]
  );

  return (
    <DataStateWrapper loading={loading} error={error} skeletonCount={4} skeletonHeight="h-32">
      <div className="px-6 py-8 space-y-12 bg-background">
        {/* Brand Momentum Snapshot */}
        <section>
          <SectionHeader eyebrow="01 — Momentum" title="Brand Momentum Snapshot" />
          {sortedCards.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <PlaceholderCard /><PlaceholderCard /><PlaceholderCard />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCards.map(c => <GlanceCardTile key={c.id} card={c} />)}
            </div>
          )}
        </section>

        {/* Asset Tracker */}
        <section>
          <SectionHeader eyebrow="02 — Awaiting from Client" title="Asset Tracker" />
          <AssetTracker
            rows={assets}
            isAdmin={isAdmin}
            availableTags={clientTags}
            onStatusChange={handleStatusChange}
            onTagToggle={handleTagToggle}
          />
        </section>

        {/* Agent Intelligence */}
        <AgentIntelligenceSection clientId={clientId} />

        {/* Marketing Calendar */}
        <section>
          <SectionHeader eyebrow="04 — Marketing Calendar" title="Seasons ahead" />
          <MarketingCalendar moments={moments} products={products} />
        </section>
      </div>
    </DataStateWrapper>
  );
};

export default AtAGlanceTab;
