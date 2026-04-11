import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';

// --- Types ---
interface PlatformCard {
  platform: string;
  subtitle: string;
  score: number;
  status: string;
  deltaPts: number;
}

interface SovRow {
  brand: string;
  pct: number;
  rank: number;
  deltaPts: number;
  highlight: boolean;
}

interface TopQuery {
  query_text: string;
  category: string;
  search_volume: number;
}

// --- Helpers ---
function statusBadge(status: string) {
  switch (status) {
    case 'strong':
      return { label: 'STRONG', style: 'bg-foreground text-background' };
    case 'needs-work':
      return { label: 'NEEDS WORK', style: 'border border-destructive text-destructive bg-transparent' };
    default:
      return { label: 'MODERATE', style: 'bg-corp-news' };
  }
}

function deltaText(pts: number) {
  if (pts > 0) return { text: `▲ +${pts}pts this month`, color: 'text-positive' };
  if (pts < 0) return { text: `▼ ${pts}pts this month`, color: 'text-negative' };
  return { text: '— flat this month', color: 'text-neutral-delta' };
}

const ALL_PLATFORMS = ['ChatGPT', 'Perplexity', 'Rufus', 'Gemini', 'Claude', 'Google AI'];
const PLATFORM_DB_KEY: Record<string, string> = {
  'chatgpt': 'chatgpt',
  'perplexity': 'perplexity',
  'rufus': 'rufus',
  'gemini': 'gemini',
  'claude': 'claude',
  'google ai': 'google_ai',
};

// --- Hardcoded data kept for now ---
const trendData = [
  { week: 'Jan 5', chatgpt: 57, perplexity: 55, rufus: 45, gemini: 48, claude: 48 },
  { week: 'Jan 12', chatgpt: 58, perplexity: 56, rufus: 46, gemini: 48, claude: 47 },
  { week: 'Jan 19', chatgpt: 60, perplexity: 57, rufus: 47, gemini: 49, claude: 47 },
  { week: 'Jan 26', chatgpt: 62, perplexity: 58, rufus: 48, gemini: 49, claude: 46 },
  { week: 'Feb 2', chatgpt: 63, perplexity: 59, rufus: 50, gemini: 50, claude: 46 },
  { week: 'Feb 9', chatgpt: 65, perplexity: 61, rufus: 52, gemini: 50, claude: 45 },
  { week: 'Feb 16', chatgpt: 67, perplexity: 63, rufus: 54, gemini: 51, claude: 45 },
  { week: 'Feb 23', chatgpt: 69, perplexity: 64, rufus: 56, gemini: 51, claude: 44 },
  { week: 'Mar 2', chatgpt: 70, perplexity: 65, rufus: 57, gemini: 51, claude: 44 },
  { week: 'Mar 9', chatgpt: 71, perplexity: 66, rufus: 59, gemini: 51, claude: 43 },
  { week: 'Mar 16', chatgpt: 73, perplexity: 67, rufus: 60, gemini: 51, claude: 43 },
  { week: 'Mar 23', chatgpt: 74, perplexity: 68, rufus: 61, gemini: 51, claude: 43 },
];


// --- Sub-components ---
const PlatformScorecards = ({ cards, loading }: { cards: PlatformCard[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const cardMap = new Map(cards.map(c => [c.platform.toLowerCase(), c]));

  return (
    <div className="grid grid-cols-6 gap-4">
      {ALL_PLATFORMS.map((platform) => {
        const s = cardMap.get(platform.toLowerCase());
        if (!s) {
          return (
            <div key={platform} className="bg-card border border-border p-4 opacity-50">
              <p className="text-xs font-bold tracking-wider uppercase">{platform}</p>
              <p className="text-[10px] text-muted-foreground mb-2">—</p>
              <p className="text-lg font-medium text-muted-foreground mt-4">No data this week</p>
            </div>
          );
        }
        const badge = statusBadge(s.status);
        const delta = deltaText(s.deltaPts);
        return (
          <div key={s.platform} className="bg-card border border-border p-4">
            <p className="text-xs font-bold tracking-wider uppercase">{s.platform}</p>
            <p className="text-[10px] text-muted-foreground mb-2 truncate">{s.subtitle}</p>
            <p className="text-3xl font-bold text-foreground mb-1">{s.score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
            <span className={`inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-1 ${badge.style}`}>{badge.label}</span>
            <p className={`text-[11px] ${delta.color}`}>{delta.text}</p>
          </div>
        );
      })}
    </div>
  );
};

export const ViewToggle = ({ active, onToggle }: { active: string; onToggle: (v: string) => void }) => (
  <div className="flex gap-0 border border-border w-fit">
    {['BY PLATFORM', 'HEATMAP', 'GAP ANALYSIS', 'TOP QUERIES + SOV'].map((v) => (
      <button key={v} onClick={() => onToggle(v)} className={`px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${active === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
        {v}
      </button>
    ))}
  </div>
);

const SovSection = ({ rows, loading }: { rows: SovRow[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No competitive SOV data for this week.</p>;
  }

  const maxPct = Math.max(...rows.map(r => r.pct), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const delta = deltaText(row.deltaPts);
        return (
          <div key={row.brand} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-4 text-right">#{row.rank}</span>
            <span className={`text-xs w-32 truncate ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/80'}`}>{row.brand}</span>
            <div className="flex-1 h-4 bg-secondary">
              <div className={`h-full ${row.highlight ? 'bg-foreground' : 'bg-foreground/40'}`} style={{ width: `${(row.pct / maxPct) * 100}%` }} />
            </div>
            <span className={`text-xs w-8 text-right ${row.highlight ? 'font-bold' : ''}`}>{row.pct}%</span>
            {row.highlight && row.deltaPts !== 0 && (
              <span className={`text-[10px] ${delta.color}`}>{row.deltaPts > 0 ? `▲ +${row.deltaPts}pts` : `▼ ${row.deltaPts}pts`}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- Main component ---
const AIVisibilityTab = () => {
  const [view, setView] = useState('BY PLATFORM');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const { selectedWeek, refreshKey, activeClientId } = useWeek();
  const { clientName } = useAdmin();

  const [cards, setCards] = useState<PlatformCard[]>([]);
  const [sovRows, setSovRows] = useState<SovRow[]>([]);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [sovLoading, setSovLoading] = useState(true);
  const [queriesLoading, setQueriesLoading] = useState(true);

  // Fetch platform scorecards
  useEffect(() => {
    if (!selectedWeek || !activeClientId) {
      setCards([]);
      setCardsLoading(false);
      return;
    }
    const fetch = async () => {
      setCardsLoading(true);
      const { data, error } = await supabase
        .from('ai_visibility')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('visibility_score', { ascending: false });

      if (error) {
        console.error('Failed to fetch ai_visibility:', error);
        setCards([]);
      } else {
        setCards((data ?? []).map((row: any) => ({
          platform: row.platform ?? '',
          subtitle: row.subtitle ?? '',
          score: row.visibility_score ?? 0,
          status: row.status ?? 'moderate',
          deltaPts: row.delta_pts ?? 0,
        })));
      }
      setCardsLoading(false);
    };
    fetch();
  }, [selectedWeek, activeClientId, refreshKey]);

  // Fetch competitive SOV
  useEffect(() => {
    if (!selectedWeek || !activeClientId) {
      setSovRows([]);
      setSovLoading(false);
      return;
    }
    const fetch = async () => {
      setSovLoading(true);
      const { data, error } = await supabase
        .from('competitive_sov')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('rank', { ascending: true });

      if (error) {
        console.error('Failed to fetch competitive_sov:', error);
        setSovRows([]);
      } else {
        const lowerClientName = (clientName ?? '').toLowerCase();
        setSovRows((data ?? []).map((row: any) => ({
          brand: row.brand_name ?? '',
          pct: row.sov_pct ?? 0,
          rank: row.rank ?? 0,
          deltaPts: row.delta_pts ?? 0,
          highlight: (row.brand_name ?? '').toLowerCase() === lowerClientName,
        })));
      }
      setSovLoading(false);
    };
    fetch();
  }, [selectedWeek, activeClientId, refreshKey, clientName]);

  // Fetch top queries
  useEffect(() => {
    if (!selectedWeek || !activeClientId) {
      setTopQueries([]);
      setQueriesLoading(false);
      return;
    }
    const fetchQueries = async () => {
      setQueriesLoading(true);
      const { data, error } = await supabase
        .from('ai_top_queries')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('search_volume', { ascending: false });

      if (error) {
        console.error('Failed to fetch ai_top_queries:', error);
        setTopQueries([]);
      } else {
        setTopQueries((data ?? []).map((row: any) => ({
          query_text: row.query_text ?? '',
          category: row.category ?? '',
          search_volume: row.search_volume ?? 0,
        })));
      }
      setQueriesLoading(false);
    };
    fetchQueries();
  }, [selectedWeek, activeClientId, refreshKey]);

  return (
    <div className="p-6 space-y-6">
      <PlatformScorecards cards={cards} loading={cardsLoading} />
      <ViewToggle active={view} onToggle={setView} />

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Visibility Score Trend — 12 Weeks</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
              <YAxis domain={[30, 85]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
              <Line type="monotone" dataKey="chatgpt" name="ChatGPT" stroke="hsl(0 0% 9%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="perplexity" name="Perplexity" stroke="hsl(0 0% 30%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rufus" name="Rufus" stroke="hsl(38 80% 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gemini" name="Gemini" stroke="hsl(0 0% 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="claude" name="Claude" stroke="hsl(0 0% 75%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[
              { name: 'ChatGPT', color: 'hsl(0 0% 9%)' },
              { name: 'Perplexity', color: 'hsl(0 0% 30%)' },
              { name: 'Rufus', color: 'hsl(38 80% 55%)' },
              { name: 'Gemini', color: 'hsl(0 0% 55%)' },
              { name: 'Claude', color: 'hsl(0 0% 75%)' },
            ].map((l) => (
              <div key={l.name} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-muted-foreground">{l.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">AI SOV vs Competitive Set</h3>
          <SovSection rows={sovRows} loading={sovLoading} />
        </div>
      </div>

      {/* Top Queries — live from Supabase */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">Top Queries Where {clientName ?? 'Brand'} Appears</h3>
        <p className="text-[10px] text-muted-foreground mb-4">Expand each query for per-platform detail and competitive SOV — ranked dynamically</p>
        {queriesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : topQueries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No top query data for this week.</p>
        ) : (() => {
          const categories = ['All', ...Array.from(new Set(topQueries.map(q => q.category).filter(Boolean))).sort()];
          const filtered = topQueries
            .filter(q => categoryFilter === 'All' || q.category === categoryFilter)
            .sort((a, b) => (b.search_volume - a.search_volume) || a.query_text.localeCompare(b.query_text))
            .slice(0, 20);
          return (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors border ${categoryFilter === cat ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-border">
                {filtered.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-3">
                    <span className="text-sm font-bold w-6 text-right text-muted-foreground">{idx + 1}</span>
                    <span className="text-sm font-medium flex-1">"{q.query_text}"</span>
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-muted text-muted-foreground">{q.category}</span>
                    {q.search_volume > 0 && (
                      <span className="text-[11px] text-muted-foreground">{q.search_volume.toLocaleString()} searches</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default AIVisibilityTab;
