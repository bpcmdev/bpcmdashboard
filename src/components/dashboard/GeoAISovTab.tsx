import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle } from './AIVisibilityTab';
import PaginationControls from './PaginationControls';

// --- Types ---
interface PlatformCard {
  platform: string;
  score: number;
  status: string;
  deltaPts: number;
}

interface SovRow {
  brand_name: string;
  sov_pct: number;
  rank: number;
  delta_pts: number;
  article_count: number;
  platform: string;
}

interface TopQuery {
  query_text: string;
  category: string;
  search_volume: number;
  sov_pct: number | null;
}

// --- Helpers ---
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  gemini: 'Gemini',
  claude: 'Claude',
  rufus: 'Rufus',
};

const ALL_PLATFORMS = ['chatgpt', 'perplexity', 'google_ai', 'gemini', 'claude', 'rufus'];

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
  if (pts > 0) return { text: `▲ +${pts}pts`, color: 'text-positive' };
  if (pts < 0) return { text: `▼ ${pts}pts`, color: 'text-negative' };
  return { text: '— flat', color: 'text-neutral-delta' };
}

const heatmapColor = (val: number) => {
  if (val >= 20) return 'bg-foreground text-background';
  if (val >= 10) return 'bg-foreground/70 text-background';
  if (val >= 5) return 'bg-foreground/40 text-background';
  return 'bg-muted text-muted-foreground';
};

const PAGE_SIZE = 10;

// --- Main component ---
const GeoAISovTab = () => {
  const [view, setView] = useState('BY PLATFORM');
  const { selectedWeek, refreshKey, activeClientId } = useWeek();
  const { clientName } = useAdmin();

  const [cards, setCards] = useState<PlatformCard[]>([]);
  const [sovRows, setSovRows] = useState<SovRow[]>([]);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [sovLoading, setSovLoading] = useState(true);
  const [queriesLoading, setQueriesLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [queryPage, setQueryPage] = useState(1);

  // Fetch platform scorecards from ai_visibility
  useEffect(() => {
    if (!selectedWeek || !activeClientId) { setCards([]); setCardsLoading(false); return; }
    const run = async () => {
      setCardsLoading(true);
      const { data, error } = await supabase
        .from('ai_visibility')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('visibility_score', { ascending: false });
      if (error) { console.error(error); setCards([]); }
      else {
        setCards((data ?? []).map((r: any) => ({
          platform: r.platform ?? '',
          score: r.visibility_score ?? 0,
          status: r.status ?? 'moderate',
          deltaPts: r.delta_pts ?? 0,
        })));
      }
      setCardsLoading(false);
    };
    run();
  }, [selectedWeek, activeClientId, refreshKey]);

  // Fetch competitive SOV
  useEffect(() => {
    if (!selectedWeek || !activeClientId) { setSovRows([]); setSovLoading(false); return; }
    const run = async () => {
      setSovLoading(true);
      const { data, error } = await supabase
        .from('competitive_sov')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('rank', { ascending: true });
      if (error) { console.error(error); setSovRows([]); }
      else { setSovRows(data ?? []); }
      setSovLoading(false);
    };
    run();
  }, [selectedWeek, activeClientId, refreshKey]);

  // Fetch top queries
  useEffect(() => {
    if (!selectedWeek || !activeClientId) { setTopQueries([]); setQueriesLoading(false); return; }
    const run = async () => {
      setQueriesLoading(true);
      const { data, error } = await supabase
        .from('ai_top_queries')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('search_volume', { ascending: false });
      if (error) { console.error(error); setTopQueries([]); }
      else {
        setTopQueries((data ?? []).map((r: any) => ({
          query_text: r.query_text ?? '',
          category: r.category ?? '',
          search_volume: r.search_volume ?? 0,
          sov_pct: r.sov_pct ?? null,
        })));
      }
      setQueriesLoading(false);
    };
    run();
  }, [selectedWeek, activeClientId, refreshKey]);

  const cardMap = new Map(cards.map(c => [c.platform, c]));
  const lowerClient = (clientName ?? '').toLowerCase();

  return (
    <div className="p-6 space-y-6">
      {/* Scorecards */}
      {cardsLoading ? (
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-4">
          {ALL_PLATFORMS.map((key) => {
            const c = cardMap.get(key);
            if (!c) return (
              <div key={key} className="bg-card border border-border p-4 opacity-50">
                <p className="text-xs font-bold tracking-wider uppercase">{PLATFORM_LABELS[key]}</p>
                <p className="text-lg font-medium text-muted-foreground mt-4">No data</p>
              </div>
            );
            const badge = statusBadge(c.status);
            const delta = deltaText(c.deltaPts);
            return (
              <div key={key} className="bg-card border border-border p-4">
                <p className="text-xs font-bold tracking-wider uppercase">{PLATFORM_LABELS[key]}</p>
                <p className="text-3xl font-bold text-foreground mb-1">{c.score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                <span className={`inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-1 ${badge.style}`}>{badge.label}</span>
                <p className={`text-[11px] ${delta.color}`}>{delta.text}</p>
              </div>
            );
          })}
        </div>
      )}

      <ViewToggle active={view} onToggle={setView} />

      {/* BY PLATFORM — one bar chart per platform showing competitive SOV */}
      {view === 'BY PLATFORM' && (
        sovLoading ? (
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}
          </div>
        ) : sovRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No competitive SOV data for this week.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {cards.map((platform) => {
              const label = PLATFORM_LABELS[platform.platform] || platform.platform;
              const chartData = sovRows
                .sort((a, b) => b.sov_pct - a.sov_pct)
                .map(r => ({ brand: r.brand_name, score: r.sov_pct }));
              return (
                <div key={platform.platform} className="bg-card border border-border p-5">
                  <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
                    {label} — Competitive SOV
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
                      <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="brand" tick={{ fontSize: 10, fill: 'hsl(0 0% 30%)' }} axisLine={false} tickLine={false} width={95} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
                      <Bar
                        dataKey="score"
                        barSize={14}
                        radius={[0, 1, 1, 0]}
                        fill="hsl(0 0% 60%)"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        shape={(props: any) => {
                          const isClient = (props?.payload?.brand ?? '').toLowerCase() === lowerClient;
                          return <rect {...props} fill={isClient ? 'hsl(0 0% 9%)' : 'hsl(0 0% 60%)'} />;
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* HEATMAP — brands (rows) x platforms (columns) with sov_pct */}
      {view === 'HEATMAP' && (
        sovLoading ? (
          <div className="bg-card border border-border p-5 space-y-3">
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : sovRows.length === 0 ? (
          <div className="bg-card border border-border p-5">
            <p className="text-sm text-muted-foreground text-center py-6">No data available.</p>
          </div>
        ) : (
          <div className="bg-card border border-border p-5 overflow-x-auto">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">SOV Heatmap — All Platforms</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground w-36">Brand</th>
                  {cards.map(c => (
                    <th key={c.platform} className="text-center py-2 px-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">
                      {PLATFORM_LABELS[c.platform] || c.platform}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sovRows.sort((a, b) => a.rank - b.rank).map(row => {
                  const isClient = row.brand_name.toLowerCase() === lowerClient;
                  return (
                    <tr key={row.brand_name} className={`border-b border-border ${isClient ? 'font-bold' : ''}`}>
                      <td className="py-2 pr-4">{row.brand_name}</td>
                      {cards.map(c => (
                        <td key={c.platform} className="py-1 px-1">
                          <div className={`text-center py-1.5 ${heatmapColor(row.sov_pct)}`}>{row.sov_pct.toFixed(1)}%</div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* GAP ANALYSIS — Milk Makeup vs #1 competitor */}
      {view === 'GAP ANALYSIS' && (
        sovLoading ? (
          <div className="bg-card border border-border p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : sovRows.length === 0 ? (
          <div className="bg-card border border-border p-5">
            <p className="text-sm text-muted-foreground text-center py-6">No competitive data available.</p>
          </div>
        ) : (() => {
          const clientRow = sovRows.find(r => r.brand_name.toLowerCase() === lowerClient);
          const topCompetitor = sovRows.find(r => r.brand_name.toLowerCase() !== lowerClient && r.rank === 1)
            || sovRows.find(r => r.brand_name.toLowerCase() !== lowerClient);
          if (!clientRow) return <div className="bg-card border border-border p-5"><p className="text-sm text-muted-foreground text-center py-6">No client data found.</p></div>;

          const gap = topCompetitor ? (clientRow.sov_pct - topCompetitor.sov_pct) : 0;
          const maxPct = Math.max(clientRow.sov_pct, topCompetitor?.sov_pct ?? 0, 1);

          return (
            <div className="bg-card border border-border p-5 space-y-6">
              <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                {clientName ?? 'Brand'} vs Top Competitor — Gap Analysis
              </h3>

              {/* SOV Gap */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Share of Voice</span>
                  <span className={`text-[11px] font-bold ${gap >= 0 ? 'text-positive' : 'text-destructive'}`}>
                    {gap >= 0 ? '+' : ''}{gap.toFixed(1)}pts {gap >= 0 ? 'ahead' : 'behind'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-28 truncate font-medium">{clientRow.brand_name}</span>
                    <div className="flex-1 h-5 bg-secondary">
                      <div className="h-full bg-foreground" style={{ width: `${(clientRow.sov_pct / maxPct) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold w-12 text-right">{clientRow.sov_pct}%</span>
                  </div>
                  {topCompetitor && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-28 truncate text-muted-foreground">{topCompetitor.brand_name}</span>
                      <div className="flex-1 h-5 bg-secondary">
                        <div className="h-full bg-foreground/30" style={{ width: `${(topCompetitor.sov_pct / maxPct) * 100}%` }} />
                      </div>
                      <span className="text-[11px] w-12 text-right text-muted-foreground">{topCompetitor.sov_pct}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Article Count Gap */}
              {topCompetitor && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Article Count</span>
                    <span className={`text-[11px] font-bold ${clientRow.article_count >= topCompetitor.article_count ? 'text-positive' : 'text-destructive'}`}>
                      {clientRow.article_count >= topCompetitor.article_count ? '+' : ''}{clientRow.article_count - topCompetitor.article_count} articles
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(() => {
                      const maxArt = Math.max(clientRow.article_count, topCompetitor.article_count, 1);
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] w-28 truncate font-medium">{clientRow.brand_name}</span>
                            <div className="flex-1 h-5 bg-secondary">
                              <div className="h-full bg-foreground" style={{ width: `${(clientRow.article_count / maxArt) * 100}%` }} />
                            </div>
                            <span className="text-[11px] font-bold w-12 text-right">{clientRow.article_count.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] w-28 truncate text-muted-foreground">{topCompetitor.brand_name}</span>
                            <div className="flex-1 h-5 bg-secondary">
                              <div className="h-full bg-foreground/30" style={{ width: `${(topCompetitor.article_count / maxArt) * 100}%` }} />
                            </div>
                            <span className="text-[11px] w-12 text-right text-muted-foreground">{topCompetitor.article_count.toLocaleString()}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* All brands ranking */}
              <div>
                <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Full Ranking</h4>
                <div className="divide-y divide-border">
                  {sovRows.sort((a, b) => a.rank - b.rank).map(r => {
                    const isClient = r.brand_name.toLowerCase() === lowerClient;
                    return (
                      <div key={r.brand_name} className={`flex items-center gap-3 py-2 ${isClient ? 'font-bold' : ''}`}>
                        <span className="text-[10px] text-muted-foreground w-4 text-right">#{r.rank}</span>
                        <span className="text-xs flex-1">{r.brand_name}</span>
                        <span className="text-xs">{r.sov_pct}%</span>
                        <span className={`text-[10px] ${deltaText(r.delta_pts).color}`}>{deltaText(r.delta_pts).text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* TOP QUERIES + SOV */}
      {view === 'TOP QUERIES + SOV' && (
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">Top Queries Where {clientName ?? 'Brand'} Appears</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Ranked by search volume — with share-of-voice data</p>
          {queriesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : topQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No query data for this week.</p>
          ) : (() => {
            const categories = ['All', ...Array.from(new Set(topQueries.map(q => q.category).filter(Boolean))).sort()];
            const allFiltered = topQueries
              .filter(q => categoryFilter === 'All' || q.category === categoryFilter)
              .sort((a, b) => (b.search_volume - a.search_volume) || a.query_text.localeCompare(b.query_text));
            const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
            const safePage = Math.min(queryPage, totalPages);
            const paged = allFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
            return (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => { setCategoryFilter(cat); setQueryPage(1); }}
                      className={`px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors border ${categoryFilter === cat ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 w-6">#</th>
                      <th className="text-left py-2">Query</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-right py-2">Volume</th>
                      <th className="text-right py-2">SOV %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((q, idx) => (
                      <tr key={idx} className="border-b border-border">
                        <td className="py-2 text-muted-foreground">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="py-2 font-medium">"{q.query_text}"</td>
                        <td className="py-2"><span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-muted text-muted-foreground">{q.category}</span></td>
                        <td className="py-2 text-right text-muted-foreground">{q.search_volume > 0 ? q.search_volume.toLocaleString() : '—'}</td>
                        <td className="py-2 text-right font-medium">{q.sov_pct != null ? `${q.sov_pct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setQueryPage} />
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default GeoAISovTab;
