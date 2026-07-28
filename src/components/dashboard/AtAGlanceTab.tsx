import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
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

interface AssetRow {
  id: string;
  launch: string;
  target_date: string | null;
  status: 'received' | 'due_soon' | 'urgent' | string;
  assets_needed: string | null;
  notes: string | null;
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
function GlanceCardTile({ card }: { card: GlanceCard }) {
  const isDark = !!card.featured;
  return (
    <div
      className={[
        'rounded-lg p-5 transition-all hover:-translate-y-0.5',
        isDark
          ? 'bg-foreground text-background border border-foreground'
          : 'bg-white text-foreground border border-black/10',
      ].join(' ')}
      style={isDark ? { boxShadow: '0 1px 0 rgba(0,0,0,0.04)' } : undefined}
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
type SortKey = 'launch' | 'target_date' | 'status';
const statusOrder: Record<string, number> = { urgent: 0, due_soon: 1, received: 2 };

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    received: { label: 'Received',   cls: 'bg-[hsl(145_63%_42%/0.15)] text-[hsl(145_63%_28%)] border border-[hsl(145_63%_42%/0.35)]' },
    due_soon: { label: 'Due soon',   cls: 'bg-[hsl(42_85%_50%/0.18)]  text-[hsl(36_75%_30%)] border border-[hsl(42_85%_50%/0.4)]' },
    urgent:   { label: 'Urgent',     cls: 'bg-[hsl(0_75%_55%/0.15)]   text-[hsl(0_75%_38%)]  border border-[hsl(0_75%_55%/0.35)]' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border border-border' };
  return <span className={`inline-block px-2 py-0.5 text-[10px] font-mono-ui tracking-wider uppercase rounded-full ${m.cls}`}>{m.label}</span>;
}

function AssetTracker({ rows }: { rows: AssetRow[] }) {
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
              <Th>Assets Needed</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} className={i % 2 ? 'bg-black/[0.015]' : ''}>
                <td className="px-4 py-3 font-medium text-foreground">{r.launch}</td>
                <td className="px-4 py-3 font-mono-ui text-[12px] tracking-wider text-foreground/80">
                  {r.target_date ? new Date(r.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                <td className="px-4 py-3 text-foreground/80">{r.assets_needed || '—'}</td>
                <td className="px-4 py-3 text-foreground/60 text-[13px]">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Agent Intelligence — pipeline_moments cards
   ───────────────────────────────────────────────────────────────── */
const priorityBorder: Record<string, string> = {
  active:   'hsl(0 75% 50%)',
  watch:    'hsl(42 85% 50%)',
  upcoming: 'rgba(0,0,0,0.25)',
};

function AgentCard({ m }: { m: PipelineMoment }) {
  const border = priorityBorder[m.priority ?? 'upcoming'] ?? priorityBorder.upcoming;
  const monitors = toArray(m.monitor_strings);
  return (
    <div
      className="bg-white border border-black/10 rounded-lg p-5 transition-all hover:-translate-y-0.5"
      style={{ borderLeft: `4px solid ${border}` }}
    >
      <h3 className="font-display text-[18px] leading-snug mb-1.5 text-foreground">{m.title}</h3>
      {m.description && <p className="text-[13px] leading-relaxed text-foreground/75 mb-3">{m.description}</p>}
      {monitors.length > 0 && (
        <div className="text-[12px] text-foreground/70 mb-3">
          <span className="font-semibold text-foreground/80">Monitor:</span>{' '}
          <span className="font-mono-ui text-[11px] tracking-wide">{monitors.join(' / ')}</span>
        </div>
      )}
      <div className="pt-3 border-t border-black/10 font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
        {m.event_type}
      </div>
    </div>
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

  if (!groups.length) return <PlaceholderCard />;

  return (
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
            <div className="space-y-3">
              {g.entries.map(e => (
                <div key={e.id} className="bg-white border border-black/10 rounded-md p-3">
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
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Tab root
   ───────────────────────────────────────────────────────────────── */
const AtAGlanceTab = () => {
  const { activeClientId: clientId, selectedWeek, isAllTime, isYTD, ytdFrom, refreshKey } = useWeek();

  const [cards, setCards]       = useState<GlanceCard[]>([]);
  const [assets, setAssets]     = useState<AssetRow[]>([]);
  const [moments, setMoments]   = useState<PipelineMoment[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

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
        const assetsPromise   = supabase.from('asset_tracker').select('*').eq('client_id', clientId);
        const momentsPromise  = supabase.from('pipeline_moments').select('*').eq('client_id', clientId).order('event_date', { ascending: true });
        const productsPromise = supabase.from('product_pipeline').select('*').eq('client_id', clientId).order('launch_date', { ascending: true });

        const [g, a, m, p] = await Promise.all([glancePromise, assetsPromise, momentsPromise, productsPromise]);
        if (cancelled) return;
        if (g.error || a.error || m.error || p.error) {
          console.error('[AtAGlance] load error', { g: g.error, a: a.error, m: m.error, p: p.error });
          setError(true);
        } else {
          setCards((g.data ?? []) as GlanceCard[]);
          setAssets((a.data ?? []) as AssetRow[]);
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
  }, [clientId, selectedWeek, isAllTime, isYTD, ytdFrom, refreshKey]);

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
          <AssetTracker rows={assets} />
        </section>

        {/* Agent Intelligence */}
        <section>
          <SectionHeader eyebrow="03 — Agent Intelligence" title="What we're watching" />
          {moments.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PlaceholderCard /><PlaceholderCard />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {moments.map(m => <AgentCard key={m.id} m={m} />)}
            </div>
          )}
        </section>

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
