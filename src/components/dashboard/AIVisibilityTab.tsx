import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import TopDomainsSection from './TopDomainsSection';
import PaginationControls from './PaginationControls';
import HeatmapView from './ai-visibility/HeatmapView';
import GapAnalysisView from './ai-visibility/GapAnalysisView';
import TopQueriesSovView from './ai-visibility/TopQueriesSovView';

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
  articleCount: number;
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
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const cardMap = new Map(cards.map(c => [c.platform.toLowerCase(), c]));

  return (
    <div className="grid grid-cols-6 gap-4">
      {ALL_PLATFORMS.map((platform) => {
        const dbKey = PLATFORM_DB_KEY[platform.toLowerCase()] || platform.toLowerCase();
        const s = cardMap.get(dbKey);
        if (!s) {
          return (
            <div key={platform} className="bg-card border border-border p-4 opacity-50">
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(225, 70%, 35%)' }}>{platform}</p>
              <p className="text-[10px] text-muted-foreground mb-2">—</p>
              <p className="text-lg font-medium text-muted-foreground mt-4">No data this week</p>
            </div>
          );
        }
        const badge = statusBadge(s.status);
        const delta = deltaText(s.deltaPts);
        const scoreColor = s.score >= 60 ? '#6EE7A0' : s.score >= 30 ? 'hsl(var(--chart-gold))' : '#FCA5A5';
        const pct = Math.max(0, Math.min(100, s.score));
        return (
          <div key={platform} className="bg-card border border-border p-4">
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(225, 70%, 35%)' }}>{platform}</p>
            <p className="text-[10px] text-muted-foreground mb-2 truncate">{s.subtitle}</p>
            <p className="font-display text-3xl font-bold mb-1" style={{ color: scoreColor }}>
              {s.score}<span className="text-sm font-normal text-muted-foreground">/100</span>
            </p>
            <div className="w-full h-[3px] bg-white/[0.06] mb-2 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${pct}%`, background: scoreColor }} />
            </div>
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

const SovSection = ({ rows, loading, clientName }: { rows: SovRow[]; loading: boolean; clientName: string }) => {
  const [metric, setMetric] = useState<'sov' | 'articles'>('sov');
  const [focusedBrand, setFocusedBrand] = useState<string | null>(null);

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

  const getValue = (r: SovRow) => metric === 'sov' ? r.pct : r.articleCount;
  const maxVal = Math.max(...rows.map(getValue), 1);
  const suffix = metric === 'sov' ? '%' : '';

  return (
    <div>
      {/* Toggle */}
      <div className="flex gap-0 border border-border w-fit mb-4">
        <button onClick={() => setMetric('sov')} className={`px-2.5 py-1 text-[9px] font-semibold tracking-[0.1em] uppercase transition-colors ${metric === 'sov' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
          Share of Voice
        </button>
        <button onClick={() => setMetric('articles')} className={`px-2.5 py-1 text-[9px] font-semibold tracking-[0.1em] uppercase transition-colors ${metric === 'articles' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
          Article Count
        </button>
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {rows.map((row) => {
          const delta = deltaText(row.deltaPts);
          const val = getValue(row);
          const _isFocused = focusedBrand === null || focusedBrand === row.brand;
          const isDimmed = focusedBrand !== null && focusedBrand !== row.brand;

          return (
            <div
              key={row.brand}
              className={`flex items-center gap-3 py-0.5 cursor-pointer transition-opacity ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
              onClick={() => setFocusedBrand(prev => prev === row.brand ? null : row.brand)}
            >
              <span className="text-[10px] text-muted-foreground w-4 text-right shrink-0">#{row.rank}</span>
              <span className={`text-xs w-28 truncate shrink-0 ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/80'}`}>{row.brand}</span>
              <div className="flex-1 h-4 bg-secondary relative group">
                <div
                  className={`h-full transition-all ${row.highlight ? 'bg-foreground' : 'bg-foreground/35'}`}
                  style={{ width: `${(val / maxVal) * 100}%`, minWidth: val > 0 ? '4px' : '0px' }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10">
                  <div className="bg-foreground text-background text-[10px] px-2.5 py-1.5 whitespace-nowrap rounded-sm shadow-lg">
                    <p className="font-bold">{row.brand}</p>
                    <p>SOV: {row.pct}% · Articles: {row.articleCount.toLocaleString()}</p>
                    <p>Rank #{row.rank} · {delta.text}</p>
                  </div>
                </div>
              </div>
              <span className={`text-xs w-12 text-right shrink-0 ${row.highlight ? 'font-bold' : ''}`}>
                {val.toLocaleString()}{suffix}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-foreground" />
          <span className="text-[10px] text-muted-foreground">{clientName || 'Brand'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-foreground/35" />
          <span className="text-[10px] text-muted-foreground">Competitors</span>
        </div>
      </div>
    </div>
  );
};

// --- Main component ---
const AIVisibilityTab = () => {
  const [view, setView] = useState('BY PLATFORM');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [queryPage, setQueryPage] = useState(1);
  const QUERY_PAGE_SIZE = 10;
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

  // Fetch competitive SOV — aggregate across platforms
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
        .eq('week_start', selectedWeek);

      if (error) {
        console.error('Failed to fetch competitive_sov:', error);
        setSovRows([]);
      } else {
        // Aggregate: average sov_pct and sum article_count across platforms per brand
        const brandMap = new Map<string, { totalPct: number; totalArticles: number; count: number; totalDelta: number }>();
        (data ?? []).forEach((row: any) => {
          const brand = row.brand_name ?? '';
          const entry = brandMap.get(brand) || { totalPct: 0, totalArticles: 0, count: 0, totalDelta: 0 };
          entry.totalPct += row.sov_pct ?? 0;
          entry.totalArticles += row.article_count ?? 0;
          entry.count += 1;
          entry.totalDelta += row.delta_pts ?? 0;
          brandMap.set(brand, entry);
        });

        const lowerClientName = (clientName ?? '').toLowerCase();
        const aggregated = Array.from(brandMap.entries())
          .map(([brand, agg]) => ({
            brand,
            pct: Math.round((agg.totalPct / agg.count) * 10) / 10,
            rank: 0,
            deltaPts: Math.round((agg.totalDelta / agg.count) * 10) / 10,
            highlight: brand.toLowerCase() === lowerClientName,
            articleCount: agg.totalArticles,
          }))
          .sort((a, b) => b.pct - a.pct)
          .map((row, idx) => ({ ...row, rank: idx + 1 }));

        setSovRows(aggregated);
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

      {view === 'BY PLATFORM' && (
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3 bg-card border border-border p-5">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Visibility Score Trend — 12 Weeks</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--chart-grid))" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[30, 85]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--chart-navy))', border: 'none', borderRadius: '4px', color: 'white', fontSize: 11, boxShadow: '0 4px 16px hsl(var(--chart-navy) / 0.25)' }} />
                <Line type="monotone" dataKey="chatgpt" name="ChatGPT" stroke="hsl(var(--chart-navy))" strokeWidth={2.25} dot={false} />
                <Line type="monotone" dataKey="perplexity" name="Perplexity" stroke="hsl(var(--chart-gold))" strokeWidth={2.25} dot={false} />
                <Line type="monotone" dataKey="rufus" name="Rufus" stroke="hsl(213 40% 45%)" strokeWidth={1.75} dot={false} />
                <Line type="monotone" dataKey="gemini" name="Gemini" stroke="hsl(0 0% 55%)" strokeWidth={1.75} dot={false} />
                <Line type="monotone" dataKey="claude" name="Claude" stroke="hsl(220 13% 75%)" strokeWidth={1.75} dot={false} />
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
            <SovSection rows={sovRows} loading={sovLoading} clientName={clientName ?? 'Brand'} />
          </div>
        </div>
      )}

      {view === 'HEATMAP' && <HeatmapView />}
      {view === 'GAP ANALYSIS' && <GapAnalysisView />}
      {view === 'TOP QUERIES + SOV' && <TopQueriesSovView />}

      <TopDomainsSection />

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
          const allFiltered = topQueries
            .filter(q => categoryFilter === 'All' || q.category === categoryFilter)
            .sort((a, b) => (b.search_volume - a.search_volume) || a.query_text.localeCompare(b.query_text));
          const totalPages = Math.max(1, Math.ceil(allFiltered.length / QUERY_PAGE_SIZE));
          const safeCurrentPage = Math.min(queryPage, totalPages);
          const paged = allFiltered.slice((safeCurrentPage - 1) * QUERY_PAGE_SIZE, safeCurrentPage * QUERY_PAGE_SIZE);
          return (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setQueryPage(1); }}
                    className={`px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors border ${categoryFilter === cat ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-border">
                {paged.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-3">
                    <span className="text-sm font-bold w-6 text-right text-muted-foreground">{(safeCurrentPage - 1) * QUERY_PAGE_SIZE + idx + 1}</span>
                    <span className="text-sm font-medium flex-1">"{q.query_text}"</span>
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-muted text-muted-foreground">{q.category}</span>
                    {q.search_volume > 0 && (
                      <span className="text-[11px] text-muted-foreground">{q.search_volume.toLocaleString()} searches</span>
                    )}
                  </div>
                ))}
              </div>
              <PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setQueryPage} />
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default AIVisibilityTab;
