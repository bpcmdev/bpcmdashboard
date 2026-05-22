import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle } from './AIVisibilityTab';
import PaginationControls from './PaginationControls';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

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
interface AiChat {
  id: string;
  platform: string;
  prompt_text: string;
  response_text: string;
  brands_mentioned: string;
  brand_position: number | null;
  sources: string;
  created_at: string;
}


const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  gemini: 'Gemini',
  claude: 'Claude',
  rufus: 'Rufus',
};

const ALL_PLATFORMS = ['chatgpt', 'perplexity', 'google_ai', 'gemini', 'claude', 'rufus'];
const CHART_PLATFORMS = ['chatgpt', 'google_ai', 'perplexity'];

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

  // AI Conversation Intelligence state
  const [chatMode, setChatMode] = useState<'recent' | 'mentioned'>('recent');
  const [recentChats, setRecentChats] = useState<AiChat[]>([]);
  const [mentionedChats, setMentionedChats] = useState<AiChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<AiChat | null>(null);
  const [chatPage, setChatPage] = useState(1);

  // Fetch AI chats
  useEffect(() => {
    const CLIENT_ID = '6808a53c-6bd4-4400-a6f2-8284fd3e6344';
    const run = async () => {
      setChatsLoading(true);
      const [recentRes, mentionedRes] = await Promise.all([
        supabase.from('ai_chats').select('*').eq('client_id', CLIENT_ID).order('created_at', { ascending: false }).limit(100),
        supabase.from('ai_chats').select('*').eq('client_id', CLIENT_ID).not('brand_position', 'is', null).order('created_at', { ascending: false }).limit(100),
      ]);
      setRecentChats((recentRes.data ?? []) as AiChat[]);
      setMentionedChats((mentionedRes.data ?? []) as AiChat[]);
      setChatsLoading(false);
    };
    run();
  }, [refreshKey]);

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
      else { setSovRows((data ?? []).map((r: any) => ({ ...r, platform: r.platform ?? '' }))); }
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
            {CHART_PLATFORMS.map((platformKey) => {
              const label = PLATFORM_LABELS[platformKey] || platformKey;
              const platformRows = sovRows
                .filter(r => r.platform === platformKey)
                .sort((a, b) => b.sov_pct - a.sov_pct);
              if (platformRows.length === 0) return (
                <div key={platformKey} className="bg-card border border-border p-5">
                  <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">{label} — Competitive SOV</h3>
                  <p className="text-sm text-muted-foreground text-center py-6">No data for this platform.</p>
                </div>
              );
              const chartData = platformRows.map(r => ({ brand: r.brand_name, score: r.sov_pct }));
              return (
                <div key={platformKey} className="bg-card border border-border p-5">
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
            {(() => {
              // Get unique brands sorted by average rank
              const brandMap = new Map<string, { totalPct: number; count: number; minRank: number }>();
              sovRows.forEach(r => {
                const entry = brandMap.get(r.brand_name) || { totalPct: 0, count: 0, minRank: 999 };
                entry.totalPct += r.sov_pct;
                entry.count += 1;
                entry.minRank = Math.min(entry.minRank, r.rank);
                brandMap.set(r.brand_name, entry);
              });
              const brands = Array.from(brandMap.entries())
                .sort((a, b) => a[1].minRank - b[1].minRank)
                .map(([name]) => name);

              // Build lookup: brand+platform -> sov_pct
              const lookup = new Map<string, number>();
              sovRows.forEach(r => lookup.set(`${r.brand_name}::${r.platform}`, r.sov_pct));

              const platformCols = cards.length > 0 ? cards.map(c => c.platform) : ALL_PLATFORMS;

              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground w-36">Brand</th>
                      {platformCols.map(p => (
                        <th key={p} className="text-center py-2 px-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">
                          {PLATFORM_LABELS[p] || p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map(brand => {
                      const isClient = brand.toLowerCase() === lowerClient;
                      return (
                        <tr key={brand} className={`border-b border-border ${isClient ? 'font-bold' : ''}`}>
                          <td className="py-2 pr-4">{brand}</td>
                          {platformCols.map(p => {
                            const val = lookup.get(`${brand}::${p}`);
                            return (
                              <td key={p} className="py-1 px-1">
                                {val != null ? (
                                  <div className={`text-center py-1.5 ${heatmapColor(val)}`}>{val.toFixed(1)}%</div>
                                ) : (
                                  <div className="text-center py-1.5 bg-muted text-muted-foreground">—</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )
      )}

      {/* GAP ANALYSIS — per-platform gap vs #1 competitor */}
      {view === 'GAP ANALYSIS' && (
        sovLoading ? (
          <div className="bg-card border border-border p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : sovRows.length === 0 ? (
          <div className="bg-card border border-border p-5">
            <p className="text-sm text-muted-foreground text-center py-6">No competitive data available.</p>
          </div>
        ) : (
          <div className="bg-card border border-border p-5 space-y-6">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
              {clientName ?? 'Brand'} vs Top Competitor — Per-Platform Gap Analysis
            </h3>
            {CHART_PLATFORMS.map(platformKey => {
              const platformRows = sovRows.filter(r => r.platform === platformKey);
              const clientRow = platformRows.find(r => r.brand_name.toLowerCase() === lowerClient);
              const topComp = platformRows.find(r => r.brand_name.toLowerCase() !== lowerClient && r.rank === 1)
                || platformRows.find(r => r.brand_name.toLowerCase() !== lowerClient);
              if (!clientRow) return (
                <div key={platformKey} className="space-y-1">
                  <span className="text-xs font-bold">{PLATFORM_LABELS[platformKey]}</span>
                  <p className="text-[11px] text-muted-foreground">No client data for this platform.</p>
                </div>
              );
              const gap = topComp ? (clientRow.sov_pct - topComp.sov_pct) : 0;
              const maxPct = Math.max(clientRow.sov_pct, topComp?.sov_pct ?? 0, 1);
              return (
                <div key={platformKey} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{PLATFORM_LABELS[platformKey]} — SOV</span>
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
                    {topComp && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-28 truncate text-muted-foreground">{topComp.brand_name}</span>
                        <div className="flex-1 h-5 bg-secondary">
                          <div className="h-full bg-foreground/30" style={{ width: `${(topComp.sov_pct / maxPct) * 100}%` }} />
                        </div>
                        <span className="text-[11px] w-12 text-right text-muted-foreground">{topComp.sov_pct}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
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

      {/* AI Conversation Intelligence */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI Conversation Intelligence</h3>
          <div className="flex border border-border">
            {(['recent', 'mentioned'] as const).map(mode => (
              <button key={mode} onClick={() => { setChatMode(mode); setChatPage(1); }}
                className={`px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors ${chatMode === mode ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}>
                {mode === 'recent' ? 'Recent Chats' : 'Milk Makeup Mentioned'}
              </button>
            ))}
          </div>
        </div>

        {chatsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (() => {
          const chats = chatMode === 'recent' ? recentChats : mentionedChats;
          if (chats.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No conversations found.</p>;
          const totalChatPages = Math.max(1, Math.ceil(chats.length / PAGE_SIZE));
          const safeChatPage = Math.min(chatPage, totalChatPages);
          const pagedChats = chats.slice((safeChatPage - 1) * PAGE_SIZE, safeChatPage * PAGE_SIZE);
          return (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pagedChats.map(chat => {
                  const brands = parseSafe(chat.brands_mentioned);
                  const timeAgo = formatTimeAgo(chat.created_at);
                  return (
                    <button key={chat.id} onClick={() => setSelectedChat(chat)}
                      className="bg-secondary/30 border border-border p-4 text-left hover:bg-secondary/60 transition-colors space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-foreground text-background">
                          {PLATFORM_LABELS[chat.platform] || chat.platform}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo}</span>
                      </div>
                      <p className="text-xs font-semibold text-foreground line-clamp-1">{chat.prompt_text}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-3">{chat.response_text}</p>
                      {brands.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {brands.map((b: any, i: number) => (
                            <span key={i} className="text-[9px] font-bold tracking-[0.05em] uppercase px-1.5 py-0.5 bg-muted text-muted-foreground">
                              {typeof b === 'string' ? b : b.name || b.brand || JSON.stringify(b)}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-border">
                <button onClick={() => setChatPage(safeChatPage - 1)} disabled={safeChatPage <= 1}
                  className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted">
                  Previous
                </button>
                <span className="text-[11px] text-muted-foreground">Page {safeChatPage} of {totalChatPages}</span>
                <button onClick={() => setChatPage(safeChatPage + 1)} disabled={safeChatPage >= totalChatPages}
                  className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted">
                  Next
                </button>
              </div>
            </>
          );
        })()}
      </div>

      {/* Chat detail panel */}
      <Sheet open={!!selectedChat} onOpenChange={(open) => { if (!open) setSelectedChat(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          {selectedChat && (() => {
            const brands = parseSafe(selectedChat.brands_mentioned);
            const sources = parseSafe(selectedChat.sources);
            return (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-5">
                  <SheetHeader className="p-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-foreground text-background">
                        {PLATFORM_LABELS[selectedChat.platform] || selectedChat.platform}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(selectedChat.created_at)}</span>
                    </div>
                    <SheetTitle className="text-sm font-bold text-foreground leading-snug">{selectedChat.prompt_text}</SheetTitle>
                  </SheetHeader>

                  <div>
                    <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Response</h4>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedChat.response_text}</p>
                  </div>

                  {brands.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Brands Mentioned</h4>
                      <div className="space-y-1.5">
                        {brands.map((b: any, i: number) => {
                          const name = typeof b === 'string' ? b : b.name || b.brand || JSON.stringify(b);
                          const position = typeof b === 'object' && b.position != null ? b.position : null;
                          return (
                            <div key={i} className="flex items-center justify-between bg-secondary/30 px-3 py-1.5 border border-border">
                              <span className="text-xs font-medium">{name}</span>
                              {position != null && <span className="text-[10px] text-muted-foreground">Position #{position}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Sources</h4>
                      <div className="space-y-1.5">
                        {sources.map((s: any, i: number) => {
                          const url = typeof s === 'string' ? s : s.url || s.link || '';
                          const domain = typeof s === 'object' && s.domain ? s.domain : (() => { try { return new URL(url).hostname; } catch { return url; } })();
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-between bg-secondary/30 px-3 py-1.5 border border-border hover:bg-secondary/60 transition-colors">
                              <span className="text-xs font-medium text-foreground truncate">{domain}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">↗</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

function parseSafe(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min. ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr. ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default GeoAISovTab;
