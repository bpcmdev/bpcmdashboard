/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ExternalLink, MessageSquare, Mic, Newspaper, Radio, Rss, Youtube } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { formatCount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------------------------------
 * Tab 3 — Multiplatform Tracking
 * Alternative-media listening (Brand24 → n8n → Supabase). No purely social channels by design.
 * RPCs: listening_platform_summary, listening_trend, listening_long_form,
 *       listening_chatter_latest, listening_mentions_feed
 * ---------------------------------------------------------------------------------------------- */

type Group = 'reddit' | 'youtube' | 'podcast' | 'substack' | 'blogs_forums' | 'broadcast';

interface PlatformStat {
  platform: Group;
  mentions: number;
  prior_mentions: number | null;
  positive: number;
  negative: number;
  neutral: number;
  reach: number | null;
}

interface Summary {
  tracked: boolean;
  last_synced_at: string | null;
  totals: { mentions: number; prior_mentions: number | null; positive: number; negative: number };
  platforms: PlatformStat[];
}

interface TrendResp {
  bucket: 'day' | 'week';
  series: { date: string; platform: Group; mentions: number }[];
}

interface LongFormItem {
  platform: 'podcast' | 'broadcast';
  title: string | null;
  host: string | null;
  url: string | null;
  date: string;
  snippet: string | null;
  reach: number | null;
  author: string | null;
}

interface LongForm {
  podcast_mentions: number;
  broadcast_segments: number;
  podcast_reach: number | null;
  broadcast_reach: number | null;
  has_broadcast_source: boolean;
  monthly: { month: string; podcast: number; broadcast: number }[];
  recent: LongFormItem[];
}

interface ChatterCard {
  rank: number;
  platform: string;
  community: string | null;
  author: string | null;
  quote: string;
  url: string | null;
  sentiment: number | null;
  engagement: string | null;
  signal: string | null;
  geo_implication: string | null;
  date: string | null;
}

interface Theme {
  rank: number;
  theme: string;
  summary: string | null;
  platforms: string[] | null;
  mention_count: number | null;
}

interface Chatter {
  week_start: string | null;
  cards: ChatterCard[];
  themes: Theme[];
}

interface FeedRow {
  mention_key: string;
  platform_group: Group;
  platform: string;
  host: string | null;
  url: string | null;
  title: string | null;
  content: string | null;
  sentiment: number | null;
  published_date: string;
  author_name: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
}

const PLATFORMS: Record<Group, { label: string; color: string; icon: LucideIcon }> = {
  reddit:       { label: 'Reddit',         color: 'hsl(16 85% 50%)',  icon: MessageSquare },
  youtube:      { label: 'YouTube',        color: 'hsl(0 72% 46%)',   icon: Youtube },
  podcast:      { label: 'Podcasts',       color: 'hsl(268 42% 46%)', icon: Mic },
  substack:     { label: 'Substack',       color: 'hsl(150 45% 33%)', icon: Newspaper },
  blogs_forums: { label: 'Blogs & forums', color: 'hsl(225 70% 35%)', icon: Rss },
  broadcast:    { label: 'Broadcast',      color: 'hsl(42 64% 42%)',  icon: Radio },
};
const GROUP_ORDER: Group[] = ['reddit', 'youtube', 'podcast', 'substack', 'blogs_forums', 'broadcast'];
const PAGE_SIZE = 20;

/** Raw platform values stored on mentions/chatter → display group. */
function groupOf(p: string | null | undefined): Group {
  switch (p) {
    case 'reddit': return 'reddit';
    case 'youtube':
    case 'video': return 'youtube';
    case 'podcast': return 'podcast';
    case 'substack': return 'substack';
    case 'broadcast': return 'broadcast';
    default: return 'blogs_forums';
  }
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function formatDay(d: string | null | undefined, withYear = false): string {
  if (!d) return '';
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', withYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
}

function formatMonth(d: string): string {
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short' });
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}

/** Never a percentage off a zero prior (matches Earned Media's DeltaChip rule). */
function DeltaChip({ current, prior }: { current: number; prior: number | null | undefined }) {
  if (prior == null) return null;
  if (prior === 0) {
    return current === 0
      ? <span className="text-[10px] text-muted-foreground">No change</span>
      : <span className="text-[10px] font-bold text-emerald-600">New this period</span>;
  }
  const pct = ((current - prior) / prior) * 100;
  if (!Number.isFinite(pct) || Math.round(pct) === 0) return <span className="text-[10px] text-muted-foreground">Stable</span>;
  const up = pct > 0;
  return (
    <span className={cn('text-[10px] font-bold', up ? 'text-emerald-600' : 'text-red-600')}>
      {up ? '+' : '−'}{Math.abs(Math.round(pct))}% vs prior period
    </span>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative;
  if (!total) return <div className="h-1.5 w-full bg-muted" aria-hidden />;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden bg-muted"
      role="img"
      aria-label={`${Math.round((positive / total) * 100)}% positive, ${Math.round((negative / total) * 100)}% negative`}
    >
      <div style={{ width: pct(positive), backgroundColor: 'hsl(152 55% 40%)' }} />
      <div style={{ width: pct(neutral), backgroundColor: 'hsl(0 0% 78%)' }} />
      <div style={{ width: pct(negative), backgroundColor: 'hsl(0 70% 50%)' }} />
    </div>
  );
}

function SentimentDot({ value }: { value: number | null }) {
  const label = value == null ? 'Unscored' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : 'Neutral';
  const color = value == null ? 'hsl(0 0% 85%)' : value > 0 ? 'hsl(152 55% 40%)' : value < 0 ? 'hsl(0 70% 50%)' : 'hsl(0 0% 70%)';
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} title={label} aria-label={label} />;
}

function PlatformTag({ group }: { group: Group }) {
  const meta = PLATFORMS[group];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: meta.color }}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

function engagementLine(r: { views?: number | null; likes?: number | null; comments?: number | null; reach?: number | null; platform?: string }): string | null {
  const parts: string[] = [];
  if (r.views) parts.push(`${formatCount(r.views)} views`);
  if (r.likes) parts.push(`${formatCount(r.likes)} ${r.platform === 'reddit' ? 'upvotes' : 'likes'}`);
  if (r.comments) parts.push(`${formatCount(r.comments)} comments`);
  if (!parts.length && r.reach) parts.push(`${formatCount(r.reach)} est. reach`);
  return parts.length ? parts.join(', ') : null;
}

/* ============================================================================================== */

const MultiplatformTrackingTab = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const { isAdmin } = useAdmin();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendResp | null>(null);
  const [longForm, setLongForm] = useState<LongForm | null>(null);
  const [chatter, setChatter] = useState<Chatter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [filter, setFilter] = useState<Group | null>(null);
  const [page, setPage] = useState(0);
  const [feed, setFeed] = useState<{ total: number; rows: FeedRow[] } | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);

  const range = useMemo(() => {
    if (isAllTime || !effectiveFrom || !effectiveTo) return { p_start: null, p_end: null };
    return { p_start: effectiveFrom, p_end: effectiveTo };
  }, [isAllTime, effectiveFrom, effectiveTo]);

  useEffect(() => {
    if (!activeClientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      const base = { p_client_id: activeClientId, ...range };
      const [s, t, l, c] = await Promise.all([
        supabase.rpc('listening_platform_summary' as any, base),
        supabase.rpc('listening_trend' as any, base),
        supabase.rpc('listening_long_form' as any, { ...base, p_limit: 8 }),
        supabase.rpc('listening_chatter_latest' as any, { p_client_id: activeClientId }),
      ]);
      if (cancelled) return;
      const err = s.error || t.error || l.error || c.error;
      if (err) {
        console.error('Multiplatform tracking RPC failed:', err);
        setError(true);
        setLoading(false);
        return;
      }
      setSummary((s.data ?? null) as Summary | null);
      setTrend((t.data ?? null) as TrendResp | null);
      setLongForm((l.data ?? null) as LongForm | null);
      setChatter((c.data ?? null) as Chatter | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  // Reset paging whenever the filter or period changes.
  useEffect(() => { setPage(0); }, [filter, activeClientId, effectiveFrom, effectiveTo, isAllTime]);

  useEffect(() => {
    if (!activeClientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;
    (async () => {
      setFeedLoading(true);
      const { data, error: err } = await supabase.rpc('listening_mentions_feed' as any, {
        p_client_id: activeClientId, ...range, p_platform: filter, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
      });
      if (cancelled) return;
      if (err) console.error('listening_mentions_feed failed:', err);
      const d = (data ?? {}) as { total?: number; rows?: FeedRow[] };
      setFeed({ total: num(d.total), rows: arr<FeedRow>(d.rows) });
      setFeedLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, filter, page, refreshKey]);

  const platforms = useMemo(() => {
    const list = arr<PlatformStat>(summary?.platforms);
    return list.filter(p => p.platform !== 'broadcast' || p.mentions > 0 || longForm?.has_broadcast_source);
  }, [summary, longForm]);

  const chartData = useMemo(() => {
    const series = arr<TrendResp['series'][number]>(trend?.series);
    if (!series.length) return [] as Record<string, number | string>[];
    const byDate = new Map<string, Record<string, number | string>>();
    const seed = (date: string) => {
      const row: Record<string, number | string> = { date };
      GROUP_ORDER.forEach(g => { row[g] = 0; });
      return row;
    };
    // Fill empty days so a quiet day reads as zero rather than a missing point.
    if (trend?.bucket === 'day' && range.p_start && range.p_end) {
      const d = new Date(range.p_start + 'T00:00:00');
      const end = new Date(range.p_end + 'T00:00:00');
      while (d <= end) {
        const k = d.toISOString().slice(0, 10);
        byDate.set(k, seed(k));
        d.setDate(d.getDate() + 1);
      }
    }
    for (const pt of series) {
      const k = String(pt.date).slice(0, 10);
      if (!byDate.has(k)) byDate.set(k, seed(k));
      byDate.get(k)![pt.platform] = num(pt.mentions);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [trend, range]);

  const activeGroups = useMemo(
    () => GROUP_ORDER.filter(g => chartData.some(r => num(r[g]) > 0)),
    [chartData],
  );

  /* ---------- states ---------- */

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-72 w-full" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 py-24 text-center">
        <p className="text-sm text-destructive font-medium">Multiplatform data could not be loaded. Refresh the page to try again.</p>
      </div>
    );
  }

  if (!summary || !summary.tracked) {
    return (
      <div className="p-6">
        <div className="section-card border p-10 text-center max-w-xl mx-auto">
          <p className="font-display text-lg">Multiplatform tracking isn't set up for this client yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            {isAdmin
              ? 'Add the client’s Brand24 project to brand24_client_config and the daily sync will start filling this tab.'
              : 'Your BPCM team will let you know when listening is live.'}
          </p>
        </div>
      </div>
    );
  }

  const synced = timeAgo(summary.last_synced_at);
  const totalMentions = num(summary.totals?.mentions);
  const cards = arr<ChatterCard>(chatter?.cards);
  const themes = arr<Theme>(chatter?.themes);
  const fallbackCards = !cards.length ? arr<FeedRow>(feed?.rows).filter(r => (r.content || '').length > 60).slice(0, 6) : [];
  const lf = longForm;
  const maxPage = feed ? Math.max(0, Math.ceil(feed.total / PAGE_SIZE) - 1) : 0;

  return (
    <div className="p-6 space-y-8">
      {/* ---------- Intro ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight">Organic conversation beyond social</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {formatCount(totalMentions)} organic mentions across Reddit, YouTube, podcasts, Substack, blogs and forums
            {range.p_start ? ` between ${formatDay(range.p_start)} and ${formatDay(range.p_end, true)}` : ' to date'}.
          </p>
        </div>
        <div className="text-right">
          <DeltaChip current={totalMentions} prior={summary.totals?.prior_mentions} />
          {synced && <p className="text-[11px] text-muted-foreground mt-1">Listening data updated {synced}</p>}
        </div>
      </div>

      {/* ---------- Platform strip ---------- */}
      <div className={cn('grid gap-4 grid-cols-2 md:grid-cols-3', platforms.length > 5 ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
        {platforms.map(p => {
          const meta = PLATFORMS[p.platform];
          const Icon = meta.icon;
          const scored = p.positive + p.negative + p.neutral;
          const active = filter === p.platform;
          return (
            <button
              key={p.platform}
              type="button"
              onClick={() => setFilter(active ? null : p.platform)}
              aria-pressed={active}
              className={cn(
                'section-card border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                active && 'ring-2 ring-offset-1',
              )}
              style={active ? ({ '--tw-ring-color': meta.color } as React.CSSProperties) : undefined}
              title={active ? 'Show all platforms in the feed' : `Filter the feed to ${meta.label}`}
            >
              <div className="flex items-center gap-1.5" style={{ color: meta.color }}>
                <Icon className="w-4 h-4" aria-hidden />
                <span className="text-xs font-semibold">{meta.label}</span>
              </div>
              <p className="font-display text-[28px] leading-none font-bold mt-3 tabular-nums">{formatCount(p.mentions)}</p>
              <div className="mt-1 min-h-[14px]"><DeltaChip current={p.mentions} prior={p.prior_mentions} /></div>
              <div className="mt-3">
                <SentimentBar positive={p.positive} neutral={p.neutral} negative={p.negative} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {scored ? `${Math.round((p.positive / scored) * 100)}% positive` : 'No mentions yet'}
                  {p.reach ? `, ${formatCount(p.reach)} est. reach` : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ---------- Trend ---------- */}
      <div className="section-card border p-5">
        <SectionTitle right={<span className="text-[11px] text-muted-foreground">{trend?.bucket === 'week' ? 'Weekly' : 'Daily'} mentions</span>}>
          Mentions by platform
        </SectionTitle>
        {chartData.length && activeGroups.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatDay(d)}
                tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
                axisLine={{ stroke: 'hsl(0 0% 90%)' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(d: string) => (trend?.bucket === 'week' ? `Week of ${formatDay(d, true)}` : formatDay(d, true))}
                formatter={(v: number, name: string) => [v, PLATFORMS[name as Group]?.label ?? name]}
                contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, color: 'white', fontSize: 11 }}
              />
              <Legend formatter={(name: string) => PLATFORMS[name as Group]?.label ?? name} wrapperStyle={{ fontSize: 11 }} />
              {activeGroups.map(g => (
                <Line key={g} type="monotone" dataKey={g} stroke={PLATFORMS[g].color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">No alternative-media mentions in this period.</p>
        )}
      </div>

      {/* ---------- Enthusiast chatter ---------- */}
      <div>
        <SectionTitle
          right={chatter?.week_start && cards.length
            ? <span className="text-[11px] text-muted-foreground">Week of {formatDay(chatter.week_start, true)}</span>
            : null}
        >
          {cards.length ? 'Enthusiast chatter' : 'Latest conversations'}
        </SectionTitle>
        {cards.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map(c => {
              const g = groupOf(c.platform);
              return (
                <article key={c.rank} className="section-card border p-5 flex flex-col" style={{ borderLeft: `3px solid ${PLATFORMS[g].color}` }}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <PlatformTag group={g} />
                    {c.community && <span className="text-[11px] text-muted-foreground truncate max-w-[60%]">{c.community}</span>}
                    {c.engagement && <span className="text-[11px] text-muted-foreground ml-auto">{c.engagement}</span>}
                  </div>
                  <blockquote className="font-display text-[17px] leading-snug mt-3 flex-1">“{c.quote}”</blockquote>
                  {(c.signal || c.geo_implication) && (
                    <dl className="mt-4 space-y-1.5 text-xs">
                      {c.signal && (
                        <div className="flex gap-2"><dt className="font-semibold shrink-0 w-24">Signal</dt><dd className="text-muted-foreground">{c.signal}</dd></div>
                      )}
                      {c.geo_implication && (
                        <div className="flex gap-2"><dt className="font-semibold shrink-0 w-24">GEO implication</dt><dd className="text-muted-foreground">{c.geo_implication}</dd></div>
                      )}
                    </dl>
                  )}
                  <div className="flex items-center gap-2 mt-4 text-[11px] text-muted-foreground">
                    <SentimentDot value={c.sentiment} />
                    {c.date && <span>{formatDay(c.date, true)}</span>}
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-foreground underline-offset-2 hover:underline">
                        Open source <ExternalLink className="w-3 h-3" aria-hidden />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : fallbackCards.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {fallbackCards.map(r => (
              <article key={r.mention_key} className="section-card border p-5" style={{ borderLeft: `3px solid ${PLATFORMS[r.platform_group].color}` }}>
                <div className="flex items-center gap-2">
                  <PlatformTag group={r.platform_group} />
                  <span className="text-[11px] text-muted-foreground truncate">{r.author_name || r.host}</span>
                </div>
                {r.title && <p className="text-sm font-semibold mt-2 line-clamp-1">{r.title}</p>}
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{r.content}</p>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
                  <SentimentDot value={r.sentiment} />
                  <span>{formatDay(r.published_date, true)}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-foreground hover:underline">
                      Open source <ExternalLink className="w-3 h-3" aria-hidden />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No standout conversations in this period.</p>
        )}
        {!cards.length && isAdmin && (
          <p className="text-[11px] text-muted-foreground mt-2">
            AI-annotated chatter (signal and GEO implication) appears after the Monday run of the Brand24 sync.
          </p>
        )}
      </div>

      {/* ---------- Podcasts & broadcast + themes ---------- */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="section-card border p-5 lg:col-span-3">
          <SectionTitle>Podcasts{lf?.has_broadcast_source ? ' & broadcast' : ''}</SectionTitle>
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="font-display text-[28px] leading-none font-bold tabular-nums">{formatCount(num(lf?.podcast_mentions))}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Podcast mentions</p>
            </div>
            {lf?.has_broadcast_source && (
              <div>
                <p className="font-display text-[28px] leading-none font-bold tabular-nums">{formatCount(num(lf?.broadcast_segments))}</p>
                <p className="text-[11px] text-muted-foreground mt-1">TV and radio segments</p>
              </div>
            )}
            {!!num(lf?.podcast_reach) && (
              <div>
                <p className="font-display text-[28px] leading-none font-bold tabular-nums">{formatCount(num(lf?.podcast_reach))}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Estimated podcast reach</p>
              </div>
            )}
          </div>

          {arr(lf?.monthly).length > 1 && (
            <div className="mt-5">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={arr<LongForm['monthly'][number]>(lf?.monthly)} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={(m: string) => formatMonth(m)} contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, color: 'white', fontSize: 11 }} />
                  <Bar dataKey="podcast" name="Podcasts" stackId="a" fill={PLATFORMS.podcast.color} />
                  {lf?.has_broadcast_source && <Bar dataKey="broadcast" name="Broadcast" stackId="a" fill={PLATFORMS.broadcast.color} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-5 divide-y divide-border">
            {arr<LongFormItem>(lf?.recent).length ? arr<LongFormItem>(lf?.recent).map((r, i) => (
              <div key={`${r.url ?? r.title}-${i}`} className="py-2.5 flex items-start gap-3">
                <PlatformTag group={r.platform === 'broadcast' ? 'broadcast' : 'podcast'} />
                <div className="min-w-0 flex-1">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline line-clamp-1">{r.title || r.host}</a>
                  ) : (
                    <p className="text-sm font-semibold line-clamp-1">{r.title || r.host}</p>
                  )}
                  {r.snippet && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.snippet}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatDay(r.date)}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground py-3">No podcast mentions in this period.</p>
            )}
          </div>
          {!lf?.has_broadcast_source && isAdmin && (
            <p className="text-[11px] text-muted-foreground mt-3">TV and radio monitoring isn't connected. Brand24 doesn't cover broadcast, so it needs a separate source.</p>
          )}
        </div>

        <div className="section-card border p-5 lg:col-span-2">
          <SectionTitle>Conversation themes</SectionTitle>
          {themes.length ? (
            <ol className="space-y-4">
              {themes.map(t => (
                <li key={t.rank}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{t.theme}</p>
                    {!!t.mention_count && <span className="text-[11px] text-muted-foreground shrink-0">{t.mention_count} mentions</span>}
                  </div>
                  {t.summary && <p className="text-xs text-muted-foreground mt-0.5">{t.summary}</p>}
                  {!!t.platforms?.length && (
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {[...new Set(t.platforms.map(groupOf))].map(g => <PlatformTag key={g} group={g} />)}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Themes appear once the weekly analysis has run.</p>
          )}
        </div>
      </div>

      {/* ---------- Mentions feed ---------- */}
      <div className="section-card border p-5">
        <SectionTitle right={feed ? <span className="text-[11px] text-muted-foreground">{formatCount(feed.total)} mentions</span> : null}>
          All mentions
        </SectionTitle>
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter mentions by platform">
          <button
            type="button"
            onClick={() => setFilter(null)}
            aria-pressed={filter === null}
            className={cn('px-2.5 py-1 text-xs border transition-colors focus:outline-none focus-visible:ring-2',
              filter === null ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
          >
            All
          </button>
          {platforms.map(p => (
            <button
              key={p.platform}
              type="button"
              onClick={() => setFilter(filter === p.platform ? null : p.platform)}
              aria-pressed={filter === p.platform}
              className={cn('px-2.5 py-1 text-xs border transition-colors focus:outline-none focus-visible:ring-2',
                filter === p.platform ? 'text-background' : 'border-border text-muted-foreground hover:text-foreground')}
              style={filter === p.platform ? { backgroundColor: PLATFORMS[p.platform].color, borderColor: PLATFORMS[p.platform].color } : undefined}
            >
              {PLATFORMS[p.platform].label}
            </button>
          ))}
        </div>

        {feedLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : feed && feed.rows.length ? (
          <ul className="divide-y divide-border">
            {feed.rows.map(r => {
              const eng = engagementLine(r);
              return (
                <li key={r.mention_key} className="py-3 flex items-start gap-3">
                  <SentimentDot value={r.sentiment} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <PlatformTag group={r.platform_group} />
                      <span className="text-[11px] text-muted-foreground truncate">{r.author_name || r.host}</span>
                    </div>
                    {r.title && (
                      r.url
                        ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold mt-1 hover:underline line-clamp-1">{r.title}</a>
                        : <p className="text-sm font-semibold mt-1 line-clamp-1">{r.title}</p>
                    )}
                    {r.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.content}</p>}
                    {eng && <p className="text-[11px] text-muted-foreground mt-1">{eng}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatDay(r.published_date)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {filter ? `No ${PLATFORMS[filter].label} mentions in this period.` : 'No mentions in this period.'}
          </p>
        )}

        {feed && feed.total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 text-xs">
            <span className="text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, feed.total)} of {formatCount(feed.total)}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-2.5 py-1 border border-border disabled:opacity-40 hover:bg-muted focus:outline-none focus-visible:ring-2">Previous</button>
              <button type="button" disabled={page >= maxPage} onClick={() => setPage(p => Math.min(maxPage, p + 1))}
                className="px-2.5 py-1 border border-border disabled:opacity-40 hover:bg-muted focus:outline-none focus-visible:ring-2">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplatformTrackingTab;
