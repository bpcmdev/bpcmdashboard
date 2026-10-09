import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, BarChart, Bar, LabelList, Cell, LineChart,
} from 'recharts';
import { ChevronDown, ChevronUp, ExternalLink, Search, X, Instagram, Youtube, Twitter, Music2, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { formatMoney, formatReach, formatCount } from '@/lib/format';
import DataStateWrapper from './DataStateWrapper';
import EmptyState from './EmptyState';
import Sparkline from './Sparkline';
import PaginationControls from './PaginationControls';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';
import AISummarySection from './AISummarySection';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNowStrict, format, parseISO } from 'date-fns';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

const ROYAL = '#1B2B8A';
const GOLD = '#C9A961';
const GREY = 'rgba(0,0,0,0.5)';

// ---------- types ----------
interface LeftyPost {
  id: string;
  post_id: string | null;
  campaign_name: string | null;
  network: string | null;
  author_name: string | null;
  followers: number | null;
  impressions: number | null;
  reach: number | null;
  emv: number | null;
  engagement_rate: number | null;
  post_link: string | null;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  shares: number | null;
  meta_id: string | null;
  caption_excerpt: string | null;
  thumbnail_url: string | null;
  thumbnail_fallback_url: string | null;
  saves: number | null;
}

interface Partnership {
  id: string;
  partner_name: string;
  type: string;
  status: string;
  description: string;
  emv_generated: number | null;
  start_date: string | null;
  end_date: string | null;
  notes?: string | null;
}

interface LeftyMonthlyPerf {
  client_id: string;
  month_start: string;
  active_influencers: number | null;
  posts: number | null;
  impressions: number | null;
  engagements: number | null;
  est_reach: number | null;
  eng_rate: number | null;
  emv: number | null;
}

interface LeftyInfluencer {
  meta_id: string;
  name: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  followers: number | null;
  blended_eng_rate: number | null;
  static_eng_rate: number | null;
  video_eng_rate: number | null;
  emv: number | null;
  est_reach: number | null;
}

type NetworkKey = 'all' | 'Instagram' | 'TikTok';

// ---------- helpers ----------
const normalizeNetwork = (n: string | null): string => {
  if (!n) return 'Other';
  const v = n.toLowerCase();
  if (v.includes('insta')) return 'Instagram';
  if (v.includes('tiktok') || v.includes('tik_tok') || v === 'tt') return 'TikTok';
  if (v.includes('youtube') || v === 'yt') return 'YouTube';
  if (v.includes('linkedin')) return 'LinkedIn';
  if (v.includes('twitter') || v === 'x') return 'X';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};

const tierOf = (followers: number): { label: string; color: string } => {
  if (followers >= 1_000_000) return { label: 'Mega', color: 'bg-black text-white' };
  if (followers >= 100_000) return { label: 'Macro', color: 'bg-[#1B2B8A] text-white' };
  if (followers >= 50_000) return { label: 'Mid', color: 'bg-[#C9A961] text-black' };
  return { label: 'Micro', color: 'bg-black/10 text-foreground' };
};

const postTypeOf = (url: string | null | undefined): string => {
  if (!url) return 'Post';
  const u = url.toLowerCase();
  if (u.includes('/reel/') || u.includes('/reels/')) return 'Reel';
  if (u.includes('tiktok.com')) return 'Video';
  if (u.includes('/p/')) return 'Photo';
  if (u.includes('youtu')) return 'Video';
  return 'Post';
};

const monthKey = (iso: string): string => iso.slice(0, 7); // YYYY-MM
const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

// Return every YYYY-MM between (inclusive) two keys.
const monthRange = (startKey: string, endKey: string): string[] => {
  if (!startKey || !endKey || startKey > endKey) return [];
  const [sy, sm] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  const out: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
};

// ---------- animated count ----------
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ---------- KPI card ----------
interface KpiCardProps {
  label: string;
  value: number;
  prior: number;
  format: (n: number) => string;
  spark: number[];
  delay: number;
}
const KpiCard = ({ label, value, prior, format, spark, delay }: KpiCardProps) => {
  const animated = useCountUp(value);
  const delta = prior > 0 ? ((value - prior) / prior) * 100 : 0;
  const up = delta >= 0;
  return (
    <div
      className="bg-card border border-black/10 p-5 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
        {label}
      </p>
      <p className="font-display text-3xl font-bold text-foreground tabular-nums leading-none">
        {format(animated)}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <Sparkline values={spark} color={ROYAL} width={110} height={28} />
        {prior > 0 && (
          <span
            className="font-mono-ui text-[10px] tracking-[0.1em] px-1.5 py-0.5 tabular-nums"
            style={{
              color: up ? GOLD : GREY,
              border: `1px solid ${up ? GOLD : 'rgba(0,0,0,0.15)'}`,
              backgroundColor: up ? 'rgba(201,169,97,0.08)' : 'transparent',
            }}
          >
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

// ---------- filter bar ----------
interface FilterBarProps {
  network: NetworkKey;
  setNetwork: (n: NetworkKey) => void;
  campaigns: string[];
  selectedCampaigns: string[];
  setSelectedCampaigns: (c: string[]) => void;
}
const FilterBar = ({
  network, setNetwork,
  campaigns, selectedCampaigns, setSelectedCampaigns,
}: FilterBarProps) => {
  const Pill = <T extends string>({ value, active, onClick, label }: { value: T; active: boolean; onClick: (v: T) => void; label: string }) => (
    <button
      onClick={() => onClick(value)}
      className={`font-mono-ui text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 transition-all ${
        active ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-b border-black/10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 border border-black/10">
          <Pill value="all" active={network === 'all'} onClick={setNetwork} label="All" />
          <Pill value="Instagram" active={network === 'Instagram'} onClick={setNetwork} label="Instagram" />
          <Pill value="TikTok" active={network === 'TikTok'} onClick={setNetwork} label="TikTok" />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button className="font-mono-ui text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 border border-black/10 hover:border-black/30 transition-colors">
              Campaigns {selectedCampaigns.length > 0 && (
                <span className="ml-1 text-[9px] px-1 bg-foreground text-background">{selectedCampaigns.length}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0 max-h-96 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-black/10 flex items-center justify-between">
              <span className="font-mono-ui text-[10px] tracking-[0.12em] uppercase">
                {selectedCampaigns.length} selected
              </span>
              {selectedCampaigns.length > 0 && (
                <button
                  onClick={() => setSelectedCampaigns([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {campaigns.map((c) => {
                const on = selectedCampaigns.includes(c);
                return (
                  <label key={c} className="flex items-center gap-2 px-3 py-2 hover:bg-black/[0.04] cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSelectedCampaigns(on ? selectedCampaigns.filter(x => x !== c) : [...selectedCampaigns, c])}
                      className="accent-foreground"
                    />
                    <span className="truncate">{c}</span>
                  </label>
                );
              })}
              {campaigns.length === 0 && (
                <p className="text-xs text-muted-foreground p-4">No campaigns available.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

// ---------- network badge ----------
const NetworkBadge = ({ network }: { network: string }) => {
  const n = normalizeNetwork(network);
  if (n === 'Instagram') {
    return (
      <span
        className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 text-white"
        style={{ background: 'linear-gradient(135deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' }}
      >
        {n}
      </span>
    );
  }
  if (n === 'TikTok') {
    return <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 bg-black text-white">{n}</span>;
  }
  return <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 bg-foreground text-background">{n}</span>;
};

// Content Spotlight card: post image with thumbnail_url → thumbnail_fallback_url
// fallback; falls back to the plain card layout if both are null or fail to load.
const ContentSpotlightCard = ({ p }: { p: LeftyPost }) => {
  const [src, setSrc] = useState<string | null>(p.thumbnail_url ?? p.thumbnail_fallback_url);
  const [failed, setFailed] = useState(false);
  const hasImage = !!(src && !failed);
  return (
    <LinkPreviewTrigger
      url={p.post_link ?? undefined}
      meta={[
        { label: 'Author', value: p.author_name ?? '—' },
        { label: 'Campaign', value: p.campaign_name ?? '—' },
        { label: 'Network', value: normalizeNetwork(p.network) },
        { label: 'EMV', value: formatMoney(p.emv ?? 0) },
        { label: 'Reach', value: formatReach(p.reach ?? 0) },
      ]}
      className={`block bg-card border border-black/10 p-5 text-left hover:border-[#1B2B8A]/40 hover:-translate-y-0.5 transition-all group ${hasImage ? 'overflow-hidden' : ''}`}
    >
      {hasImage && (
        <div className="aspect-[4/5] w-full overflow-hidden">
          <img
            src={src ?? undefined}
            alt={p.author_name ?? 'Post'}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => {
              if (src !== p.thumbnail_fallback_url && p.thumbnail_fallback_url) {
                setSrc(p.thumbnail_fallback_url);
              } else {
                setFailed(true);
              }
            }}
          />
        </div>
      )}
      <div className={hasImage ? '-mx-5 -mt-5 p-5' : ''}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-foreground truncate">{p.author_name ?? '—'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{p.campaign_name ?? '—'}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <NetworkBadge network={p.network ?? ''} />
          <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase text-muted-foreground">
            {postTypeOf(p.post_link)}
          </span>
        </div>
        {p.caption_excerpt && (
          <p className="text-[12px] italic text-muted-foreground mb-3 line-clamp-3">
            "{p.caption_excerpt.length > 140 ? p.caption_excerpt.slice(0, 140).trimEnd() + '…' : p.caption_excerpt}"
          </p>
        )}
        <div className={`grid grid-cols-2 ${p.saves != null ? 'md:grid-cols-3' : ''} gap-3 pt-3 border-t border-black/[0.06]`}>
          <div>
            <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Reach</p>
            <p className="font-display text-lg font-bold tabular-nums">{formatReach(p.reach ?? 0)}</p>
          </div>
          <div>
            <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</p>
            <p className="font-display text-lg font-bold tabular-nums" style={{ color: GOLD }}>{formatMoney(p.emv ?? 0)}</p>
          </div>
          {p.saves != null && (
            <div>
              <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Saves</p>
              <p className="font-display text-lg font-bold tabular-nums">{formatCount(p.saves)}</p>
            </div>
          )}
        </div>
      </div>
    </LinkPreviewTrigger>
  );
};

interface TabLeaderRow { name: string; meta_id: string | null; posts_followers: number; posts: number; reach: number; emv: number; avg_eng: number; followers: number; profile: LeftyInfluencer | null; }
interface TabData {
  has_posts: boolean;
  campaigns: string[];
  kpis: { posts: number; reach: number; emv: number; eng: number; authors: number };
  engagement: { likes: number; comments: number; views: number; shares: number };
  monthly_all: { key: string; posts: number; reach: number; emv: number; authors: number; eng: number }[];
  monthly_filtered: { key: string; posts: number; reach: number; emv: number; engagements: number }[];
  campaigns_agg: { name: string; posts: number; reach: number; emv: number; authors: number; first_date: string; last_date: string; monthly: { key: string; reach: number; emv: number }[] }[];
  leaderboard_total: number;
  leaderboard: TabLeaderRow[];
  top_posts: LeftyPost[];
}

// ---------- main tab ----------
const InfluencerIntelligenceTab = () => {
  const { activeClientId, refreshKey, isAllTime, effectiveFrom, effectiveTo } = useWeek();
  const { clientColor, isAdmin } = useAdmin();
  const accent = clientColor || ROYAL;

  const [tab, setTab] = useState<TabData | null>(null);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [monthlyPerf, setMonthlyPerf] = useState<LeftyMonthlyPerf[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerPosts, setDrawerPosts] = useState<{ id: string; post_link: string | null; network: string | null; campaign_name: string | null; posted_at: string | null; emv: number | null }[]>([]);
  const [drawerPostsLoading, setDrawerPostsLoading] = useState(false);
  const hasTabRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [network, setNetwork] = useState<NetworkKey>('all');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [chartSeries, setChartSeries] = useState<'emv' | 'posts' | 'engagements'>('emv');

  const [tableSearch, setTableSearch] = useState('');
  const [tableSort, setTableSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'emv', dir: 'desc' });
  const [tablePage, setTablePage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [leaderLimit, setLeaderLimit] = useState(10);
  const [drawerAuthor, setDrawerAuthor] = useState<string | null>(null);
  const [flashRow, setFlashRow] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Reset campaign table page when search or sort changes.
  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, tableSort]);

  // Fetch data scoped to the global WeekContext (posted_at / month_start / partnership overlap).
  useEffect(() => {
    if (!activeClientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;
    (async () => {
      const first = !hasTabRef.current;
      if (first) setLoading(true); else setRefreshing(true);
      setError(false);

      let pq = supabase
        .from('partnerships')
        .select('id, partner_name, type, status, description, emv_generated, start_date, end_date, notes')
        .eq('client_id', activeClientId);
      if (!isAllTime) {
        pq = pq
          .or(`start_date.is.null,start_date.lte.${effectiveTo}`)
          .or(`end_date.is.null,end_date.gte.${effectiveFrom}`);
      }

      // Lefty monthly rollup — filter by month_start within window.
      let mq = supabase
        .from('lefty_monthly_perf')
        .select('client_id, month_start, active_influencers, posts, impressions, engagements, est_reach, eng_rate, emv')
        .eq('client_id', activeClientId);
      if (!isAllTime) {
        mq = mq.gte('month_start', effectiveFrom).lte('month_start', effectiveTo);
      }

      const [{ data: tData, error: tErr }, { data: pData }, { data: mpData }] = await Promise.all([
        supabase.rpc('influencer_tab_data_secure' as any, {
          p_client_id: activeClientId,
          p_start: isAllTime ? null : effectiveFrom,
          p_end: isAllTime ? null : effectiveTo,
          p_network: network === 'all' ? null : network,
          p_campaigns: selectedCampaigns.length ? selectedCampaigns : null,
        }),
        pq.order('created_at', { ascending: false }),
        mq.order('month_start', { ascending: true }),
      ]);
      if (cancelled) return;
      if (tErr || !tData) { setError(true); setLoading(false); setRefreshing(false); return; }
      setTab(tData as unknown as TabData);
      hasTabRef.current = true;
      setPartnerships((pData ?? []) as Partnership[]);
      setMonthlyPerf((mpData ?? []) as LeftyMonthlyPerf[]);
      setLoading(false);
      setRefreshing(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, refreshKey, isAllTime, effectiveFrom, effectiveTo, network, selectedCampaigns]);

  const campaignList = tab?.campaigns ?? [];

  // Monthly aggregates over the last 6 months (for KPI sparklines)
  const sixMonthKeys = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const c = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }, []);

  const monthly = useMemo(
    () => new Map((tab?.monthly_all ?? []).map(m => [m.key, { posts: m.posts, reach: m.reach, emv: m.emv, authors: m.authors, eng: m.eng }])),
    [tab]
  );

  const spark = (metric: 'posts' | 'reach' | 'emv' | 'authors' | 'eng'): number[] =>
    sixMonthKeys.map(k => {
      const v = monthly.get(k);
      if (!v) return 0;
      return v[metric];
    });

  const kpis = useMemo(() => ({
    posts: { cur: tab?.kpis.posts ?? 0, prior: 0 },
    reach: { cur: tab?.kpis.reach ?? 0, prior: 0 },
    emv: { cur: tab?.kpis.emv ?? 0, prior: 0 },
    eng: { cur: tab?.kpis.eng ?? 0, prior: 0 },
    authors: { cur: tab?.kpis.authors ?? 0, prior: 0 },
  }), [tab]);

  const engagementTotals = useMemo(() => {
    const e = tab?.engagement ?? { likes: 0, comments: 0, views: 0, shares: 0 };
    return { ...e, engagements: e.likes + e.comments + e.shares };
  }, [tab]);

  // Monthly series for chart (filtered).
  // Prefers lefty_monthly_perf when neutral filters, otherwise uses server-aggregated rows.
  const filteredMonthly = useMemo(() => {
    const neutralFilters = network === 'all' && selectedCampaigns.length === 0;
    const fromIso = isAllTime ? '' : effectiveFrom;
    const toIso = isAllTime ? '' : effectiveTo;

    let rows: { key: string; posts: number; reach: number; emv: number; engagements: number }[] = [];

    if (neutralFilters && monthlyPerf.length > 0) {
      rows = monthlyPerf.map(m => ({
        key: monthKey(m.month_start ?? ''),
        posts: m.posts ?? 0,
        reach: m.est_reach ?? 0,
        emv: m.emv ?? 0,
        engagements: m.engagements ?? 0,
      }));
    } else {
      rows = (tab?.monthly_filtered ?? []).map(m => ({ key: m.key, posts: m.posts, reach: m.reach, emv: m.emv, engagements: m.engagements }));
    }

    if (rows.length === 0) return [];
    rows.sort((a, b) => a.key.localeCompare(b.key));

    // Fill missing months with zeros so the axis is continuous.
    const startKey = fromIso ? fromIso.slice(0, 7) : rows[0].key;
    const endKey = toIso ? toIso.slice(0, 7) : rows[rows.length - 1].key;
    const allKeys = monthRange(
      startKey < rows[0].key ? startKey : rows[0].key,
      endKey > rows[rows.length - 1].key ? endKey : rows[rows.length - 1].key,
    );
    const byKey = new Map(rows.map(r => [r.key, r]));
    return allKeys.map(k => {
      const r = byKey.get(k) ?? { key: k, posts: 0, reach: 0, emv: 0, engagements: 0 };
      return { month: monthLabel(k), key: k, ...r };
    });
  }, [tab, monthlyPerf, network, selectedCampaigns, isAllTime, effectiveFrom, effectiveTo]);

  const campaignAgg = useMemo(
    () => (tab?.campaigns_agg ?? []).map(c => ({
      name: c.name, posts: c.posts, reach: c.reach, emv: c.emv, authors: c.authors,
      firstDate: c.first_date, lastDate: c.last_date,
      monthly: new Map((c.monthly ?? []).map(m => [m.key, { reach: m.reach, emv: m.emv }])),
    })),
    [tab]
  );

  const top10Campaigns = useMemo(
    () => [...campaignAgg].sort((a, b) => b.emv - a.emv).slice(0, 10),
    [campaignAgg]
  );

  // Historical table rows
  const tableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    let rows = campaignAgg
      .map(c => {
        // Match to partnership by name (case-insensitive contains either way)
        const pm = partnerships.find(pp =>
          pp.partner_name.toLowerCase() === c.name.toLowerCase()
          || c.name.toLowerCase().includes(pp.partner_name.toLowerCase())
          || pp.partner_name.toLowerCase().includes(c.name.toLowerCase())
        );
        return {
          id: c.name,
          name: c.name,
          status: pm?.status ?? 'tracked',
          influencers: c.authors,
          posts: c.posts,
          reach: c.reach,
          emv: c.emv,
          firstDate: c.firstDate,
          lastDate: c.lastDate,
        };
      })
      .filter(r => !q || r.name.toLowerCase().includes(q));
    rows.sort((a, b) => {
      const k = tableSort.key as keyof typeof a;
      const av = a[k]; const bv = b[k];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return tableSort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [campaignAgg, partnerships, tableSearch, tableSort]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, totalPages);
  const paginatedRows = tableRows.slice((safeTablePage - 1) * PAGE_SIZE, safeTablePage * PAGE_SIZE);

  const toggleSort = (key: string) => {
    setTableSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const influencers = useMemo(
    () => (tab?.leaderboard ?? []).map(r => ({
      name: r.name, metaId: r.meta_id, postsFollowers: r.posts_followers, posts: r.posts,
      reach: r.reach, emv: r.emv, followers: r.followers, profile: r.profile, avgEng: r.avg_eng,
    })),
    [tab]
  );

  const topPostsGrid = tab?.top_posts ?? [];

  // Creator drawer posts (fetched on demand).
  useEffect(() => {
    if (!drawerAuthor || !activeClientId) { setDrawerPosts([]); return; }
    let cancelled = false;
    setDrawerPostsLoading(true);
    (async () => {
      const { data } = await supabase.rpc('influencer_author_posts_secure' as any, {
        p_client_id: activeClientId,
        p_author: drawerAuthor,
        p_start: isAllTime ? null : effectiveFrom,
        p_end: isAllTime ? null : effectiveTo,
        p_network: network === 'all' ? null : network,
        p_campaigns: selectedCampaigns.length ? selectedCampaigns : null,
      });
      if (cancelled) return;
      setDrawerPosts(((data as unknown) as typeof drawerPosts) ?? []);
      setDrawerPostsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [drawerAuthor, activeClientId, isAllTime, effectiveFrom, effectiveTo, network, selectedCampaigns]);

  const activePartnerships = partnerships.filter(p => p.status !== 'past');
  const drawerAuthorData = drawerAuthor ? influencers.find(i => i.name === drawerAuthor) : null;

  const scrollToCampaign = (name: string) => {
    setExpandedRow(name);
    setFlashRow(name);
    setTimeout(() => {
      rowRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setFlashRow(null), 1400);
    }, 60);
  };

  // ---------- render ----------
  return (
    <div className="p-6 space-y-8">
      <DataStateWrapper loading={loading} error={error} skeletonCount={5}>
        {!tab?.has_posts ? (
          <EmptyState icon="📣" title="No influencer data yet" description="Once posts are synced, the intelligence view will populate here." />
        ) : (
          <>
            <div className={refreshing ? 'opacity-60 transition-opacity pointer-events-none' : 'transition-opacity'}>
            {activeClientId && (
              <AISummarySection clientId={activeClientId} accent={accent} isAdmin={isAdmin} kind="influencer" functionName="influencer-summary" />
            )}
            {/* 1. Hero KPI band */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Total Posts" value={kpis.posts.cur} prior={kpis.posts.prior} format={n => Math.round(n).toLocaleString()} spark={spark('posts')} delay={0} />
              <KpiCard label="Total Reach" value={kpis.reach.cur} prior={kpis.reach.prior} format={n => formatReach(Math.round(n))} spark={spark('reach')} delay={60} />
              <KpiCard label="Total EMV" value={kpis.emv.cur} prior={kpis.emv.prior} format={n => formatMoney(Math.round(n))} spark={spark('emv')} delay={120} />
              <KpiCard label="Avg Engagement" value={kpis.eng.cur} prior={kpis.eng.prior} format={n => `${n.toFixed(2)}%`} spark={spark('eng')} delay={180} />
              <KpiCard label="Active Influencers" value={kpis.authors.cur} prior={kpis.authors.prior} format={n => Math.round(n).toLocaleString()} spark={spark('authors')} delay={240} />
            </section>

            {/* 2. Filter bar (sticky) */}
            <FilterBar
              network={network} setNetwork={setNetwork}
              campaigns={campaignList}
              selectedCampaigns={selectedCampaigns} setSelectedCampaigns={setSelectedCampaigns}
            />

            {/* 3. Performance Over Time */}
            <section className="bg-card border border-black/10 p-6 animate-fade-in">
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                <span className="section-label">Performance Over Time</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono-ui text-[10px] tracking-[0.12em] uppercase text-muted-foreground">
                    {monthlyPerf.length > 0 && network === 'all' && selectedCampaigns.length === 0
                      ? 'Lefty monthly rollup'
                      : 'Computed from posts'}
                  </span>
                  <div className="flex items-center border border-black/10">
                    {(['emv', 'posts', 'engagements'] as const).map(k => (
                      <button
                        key={k}
                        onClick={() => setChartSeries(k)}
                        className={`font-mono-ui text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 transition-all ${
                          chartSeries === k ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {k === 'emv' ? 'EMV' : k === 'posts' ? 'Posts' : 'Engagements'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {filteredMonthly.length === 0 ? (
                <p className="text-sm text-muted-foreground py-16 text-center">No posts in the selected window.</p>
              ) : (
                (() => {
                  const seriesConfig = {
                    emv:         { key: 'emv',         label: 'EMV',         color: GOLD,       format: (v: number) => formatMoney(v) },
                    posts:       { key: 'posts',       label: 'Posts',       color: '#1B2B8A',  format: (v: number) => formatCount(v) },
                    engagements: { key: 'engagements', label: 'Engagements', color: '#111111',  format: (v: number) => formatCount(v) },
                  } as const;
                  const cfg = seriesConfig[chartSeries];
                  return (
                    <ResponsiveContainer width="100%" height={360}>
                      <AreaChart data={filteredMonthly} margin={{ top: 10, right: 24, left: 8, bottom: 8 }}>
                        <defs>
                          <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={cfg.color} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={cfg.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical={false} />
                        <XAxis
                          dataKey="month"
                          interval={0}
                          tick={{ fontSize: 11, fill: 'hsl(0 0% 40%)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }}
                          axisLine={false}
                          tickLine={false}
                          tickCount={4}
                          tickFormatter={cfg.format}
                          width={56}
                        />
                        <Tooltip
                          cursor={{ stroke: 'rgba(0,0,0,0.15)', strokeWidth: 1 }}
                          contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, fontSize: 12, padding: 12 }}
                          formatter={(value: number) => [cfg.format(value), cfg.label]}
                          labelStyle={{ fontSize: 11, color: 'hsl(0 0% 40%)', marginBottom: 4 }}
                        />
                        <Area
                          type="monotone"
                          dataKey={cfg.key}
                          name={cfg.label}
                          stroke={cfg.color}
                          strokeWidth={2}
                          fill="url(#perfGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: cfg.color, stroke: 'white', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()
              )}

              {/* Engagement Breakdown */}
              <div className="mt-6 pt-6 border-t border-black/[0.08]">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="section-label">Engagement Breakdown</span>
                  <span className="font-mono-ui text-[10px] tracking-[0.12em] uppercase text-muted-foreground">Filtered window</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Likes', value: engagementTotals.likes, color: '#E4405F' },
                    { label: 'Comments', value: engagementTotals.comments, color: accent },
                    { label: 'Views', value: engagementTotals.views, color: '#000000' },
                    { label: 'Shares', value: engagementTotals.shares, color: GOLD },
                  ].map(m => (
                    <div key={m.label} className="border border-black/10 p-3">
                      <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">{m.label}</p>
                      <p className="font-display text-xl font-bold tabular-nums mt-1" style={{ color: m.color }}>{formatCount(m.value)}</p>
                    </div>
                  ))}
                </div>
                {/* Engagement mix bar (likes+comments+shares) */}
                {engagementTotals.engagements > 0 && (
                  <div className="mt-4">
                    <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Engagement mix</p>
                    <div className="flex h-3 w-full overflow-hidden border border-black/10">
                      {[
                        { key: 'Likes', v: engagementTotals.likes, color: '#E4405F' },
                        { key: 'Comments', v: engagementTotals.comments, color: accent },
                        { key: 'Shares', v: engagementTotals.shares, color: GOLD },
                      ].map(seg => {
                        const pct = (seg.v / engagementTotals.engagements) * 100;
                        return pct > 0 ? (
                          <div
                            key={seg.key}
                            title={`${seg.key}: ${formatCount(seg.v)} (${pct.toFixed(1)}%)`}
                            style={{ width: `${pct}%`, backgroundColor: seg.color }}
                          />
                        ) : null;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2">
                      {[
                        { key: 'Likes', color: '#E4405F' },
                        { key: 'Comments', color: accent },
                        { key: 'Shares', color: GOLD },
                      ].map(l => (
                        <span key={l.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="w-2 h-2 inline-block" style={{ backgroundColor: l.color }} />
                          {l.key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                  Like counts unavailable for some Instagram posts due to platform privacy settings.
                </p>
              </div>
            </section>


            {/* 4. Campaign Performance */}
            <section className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Active & Pipeline cards */}
                <div className="bg-card border border-black/10 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="section-label">Active &amp; Pipeline</span>
                    <span className="section-count">{activePartnerships.length}</span>
                  </div>
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {activePartnerships.length === 0 && (
                      <p className="text-xs text-muted-foreground">No active partnerships.</p>
                    )}
                    {activePartnerships.map((p) => {
                      const initials = p.partner_name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                      // Find matching campaign aggregate for sparkline
                      const matched = campaignAgg.find(c =>
                        c.name.toLowerCase() === p.partner_name.toLowerCase()
                        || c.name.toLowerCase().includes(p.partner_name.toLowerCase())
                        || p.partner_name.toLowerCase().includes(c.name.toLowerCase())
                      );
                      const emvSpark = matched ? sixMonthKeys.map(k => matched.monthly.get(k)?.emv ?? 0) : [];
                      return (
                        <button
                          key={p.id}
                          onClick={() => matched && scrollToCampaign(matched.name)}
                          className="w-full text-left bg-white border border-black/10 p-3 hover:border-black/30 transition-all hover:-translate-y-[1px]"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 flex items-center justify-center text-[11px] font-bold text-white shrink-0 rounded-sm"
                              style={{ background: `linear-gradient(135deg, ${accent} 0%, #047857 100%)` }}
                            >
                              {initials || '—'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-bold text-foreground truncate">{p.partner_name}</h4>
                                <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 bg-black/[0.06] text-foreground shrink-0">
                                  {(p.status || 'active').toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">{p.type}</p>
                              <div className="flex items-end justify-between mt-2 gap-2">
                                <div>
                                  <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</p>
                                  <p className="font-display text-base font-bold" style={{ color: GOLD }}>
                                    {formatMoney(matched?.emv ?? p.emv_generated ?? 0)}
                                  </p>
                                </div>
                                {emvSpark.length > 0 && <Sparkline values={emvSpark} color={accent} width={96} height={28} />}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Top 10 by EMV */}
                <div className="bg-card border border-black/10 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="section-label">Top 10 Campaigns by EMV</span>
                    <span className="section-count">{top10Campaigns.length}</span>
                  </div>
                  {top10Campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-16 text-center">No campaign data.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(280, top10Campaigns.length * 44 + 40)}>
                      <BarChart data={top10Campaigns} layout="vertical" margin={{ top: 8, right: 64, left: 8, bottom: 8 }} barCategoryGap={10}>
                        <defs>
                          <linearGradient id="barLeader" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={ROYAL} stopOpacity={0.95} />
                            <stop offset="100%" stopColor={GOLD} stopOpacity={0.95} />
                          </linearGradient>
                          <linearGradient id="barRest" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={ROYAL} stopOpacity={0.55} />
                            <stop offset="100%" stopColor={ROYAL} stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="2 4" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatMoney(v)} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={190}
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                          tick={(props: { x: number; y: number; payload: { value: string } }) => {
                            const { x, y, payload } = props;
                            const raw = payload.value || '';
                            const max = 26;
                            const label = raw.length > max ? raw.slice(0, max - 1).trimEnd() + '…' : raw;
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text x={-6} y={0} dy={4} textAnchor="end" fontSize={11} fill="hsl(0 0% 20%)" fontFamily="DM Sans, sans-serif">
                                  {label}
                                  <title>{raw}</title>
                                </text>
                              </g>
                            );
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(27,43,138,0.06)' }}
                          content={(props: { active?: boolean; payload?: Array<{ payload: typeof top10Campaigns[number] }> }) => {
                            if (!props.active || !props.payload?.[0]) return null;
                            const d = props.payload[0].payload;
                            return (
                              <div className="bg-white border border-black/10 px-3 py-2 text-[11px] shadow-md min-w-[200px]">
                                <p className="font-semibold text-foreground mb-1.5">{d.name}</p>
                                <div className="space-y-0.5 text-muted-foreground">
                                  <div className="flex justify-between gap-4"><span>EMV</span><span className="tabular-nums font-semibold" style={{ color: GOLD }}>{formatMoney(d.emv)}</span></div>
                                  <div className="flex justify-between gap-4"><span>Posts</span><span className="tabular-nums">{d.posts}</span></div>
                                  <div className="flex justify-between gap-4"><span>Reach</span><span className="tabular-nums">{formatReach(d.reach)}</span></div>
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-1.5 pt-1.5 border-t border-black/[0.06]">Click to jump to campaign</p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="emv"
                          radius={[0, 6, 6, 0]}
                          barSize={22}
                          isAnimationActive
                          animationDuration={700}
                          animationEasing="ease-out"
                          onClick={(d) => scrollToCampaign((d as unknown as { name: string }).name)}
                          style={{ cursor: 'pointer' }}
                        >
                          {top10Campaigns.map((c, i) => (
                            <Cell
                              key={c.name}
                              fill={i === 0 ? 'url(#barLeader)' : 'url(#barRest)'}
                              stroke={i === 0 ? GOLD : 'transparent'}
                              strokeWidth={i === 0 ? 1 : 0}
                            />
                          ))}
                          <LabelList
                            dataKey="emv"
                            position="right"
                            formatter={(v: number) => formatMoney(v)}
                            style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fill: 'hsl(0 0% 20%)', fontWeight: 500 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Historical searchable/sortable table */}
              <div className="bg-card border border-black/10 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <span className="section-label">All Campaigns</span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search campaigns…"
                      className="pl-8 pr-3 py-1.5 text-xs border border-black/10 bg-white w-64 focus:outline-none focus:border-black/40"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10">
                        {[
                          { k: 'name', l: 'Campaign' },
                          { k: 'status', l: 'Status' },
                          { k: 'influencers', l: 'Influencers' },
                          { k: 'posts', l: 'Posts' },
                          { k: 'reach', l: 'Reach' },
                          { k: 'emv', l: 'EMV' },
                          { k: 'firstDate', l: 'Dates' },
                        ].map(h => (
                          <th
                            key={h.k}
                            onClick={() => toggleSort(h.k)}
                            className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 pr-4 text-left cursor-pointer select-none hover:text-foreground"
                          >
                            <span className="inline-flex items-center gap-1">
                              {h.l}
                              {tableSort.key === h.k && (tableSort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.length === 0 && (
                        <tr><td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No matching campaigns.</td></tr>
                      )}
                      {paginatedRows.map(r => {
                        const isOpen = expandedRow === r.id;
                        const flash = flashRow === r.id;
                        return (
                          <>
                            <tr
                              key={r.id}
                              ref={(el) => { rowRefs.current[r.id] = el; }}
                              onClick={() => setExpandedRow(isOpen ? null : r.id)}
                              className={`border-b border-black/5 cursor-pointer hover:bg-black/[0.02] transition-colors ${flash ? 'bg-[rgba(201,169,97,0.12)]' : ''}`}
                            >
                              <td className="py-3 pr-4 font-medium text-foreground max-w-xs truncate">{r.name}</td>
                              <td className="py-3 pr-4">
                                <span className="font-mono-ui text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 bg-black/[0.06]">{r.status.toUpperCase()}</span>
                              </td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{r.influencers}</td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{r.posts}</td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{formatReach(r.reach)}</td>
                              <td className="py-3 pr-4 font-display font-bold tabular-nums">{formatMoney(r.emv)}</td>
                              <td className="py-3 pr-4 text-[11px] text-muted-foreground whitespace-nowrap">
                                {r.firstDate ? `${r.firstDate.slice(5)} → ${r.lastDate.slice(5)}` : '—'}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr key={`${r.id}-x`} className="bg-[hsl(0,0%,99%)] border-b border-black/10">
                                <td colSpan={7} className="p-4">
                                  <CampaignExpandedPanel
                                    clientId={activeClientId!}
                                    campaignName={r.name}
                                    accent={accent}
                                    network={network}
                                    start={isAllTime ? null : effectiveFrom}
                                    end={isAllTime ? null : effectiveTo}
                                  />
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls currentPage={safeTablePage} totalPages={totalPages} onPageChange={setTablePage} />
              </div>
            </section>

            {/* 5. Influencer Leaderboard */}
            <section className="animate-fade-in">
              <div className="flex items-baseline justify-between mb-4">
                <span className="section-label">Influencer Leaderboard</span>
                <span className="section-count">{tab?.leaderboard_total ?? influencers.length}</span>
              </div>

              {/* Top 3 spotlight */}
              {influencers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {influencers.slice(0, 3).map((inf, i) => {
                    const t = tierOf(inf.followers);
                    return (
                      <button
                        key={inf.name}
                        onClick={() => setDrawerAuthor(inf.name)}
                        className="text-left bg-card border border-black/10 p-5 hover:border-[#C9A961] hover:-translate-y-0.5 transition-all"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center font-display text-lg font-bold text-black"
                            style={{ background: `radial-gradient(circle at 30% 30%, #F0D68C 0%, ${GOLD} 60%, #8A6A2E 100%)` }}
                          >
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-foreground truncate">{inf.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`font-mono-ui text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 ${t.color}`}>{t.label}</span>
                              <span className="text-[10px] text-muted-foreground">{formatCount(inf.followers)} followers</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-black/[0.06]">
                          <div>
                            <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</p>
                            <p className="font-display text-lg font-bold" style={{ color: accent }}>{formatMoney(inf.emv)}</p>
                          </div>
                          <div>
                            <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Reach</p>
                            <p className="font-display text-lg font-bold">{formatReach(inf.reach)}</p>
                          </div>
                          <div>
                            <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Posts</p>
                            <p className="font-display text-lg font-bold">{inf.posts}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rest as table */}
              {influencers.length > 3 && (
                <div className="bg-card border border-black/10 p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-black/10">
                          {['#', 'Handle', 'Tier', 'Followers', 'Posts', 'Reach', 'EMV', 'Avg Eng'].map(h => (
                            <th key={h} className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 pr-4 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {influencers.slice(3, 3 + leaderLimit).map((inf, i) => {
                          const t = tierOf(inf.followers);
                          return (
                            <tr key={inf.name} onClick={() => setDrawerAuthor(inf.name)} className="border-b border-black/5 hover:bg-black/[0.02] cursor-pointer">
                              <td className="py-3 pr-4 font-mono-ui text-xs text-muted-foreground">{i + 4}</td>
                              <td className="py-3 pr-4 font-medium text-foreground">{inf.name}</td>
                              <td className="py-3 pr-4"><span className={`font-mono-ui text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 ${t.color}`}>{t.label}</span></td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{formatCount(inf.followers)}</td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{inf.posts}</td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{formatReach(inf.reach)}</td>
                              <td className="py-3 pr-4 font-display font-bold tabular-nums">{formatMoney(inf.emv)}</td>
                              <td className="py-3 pr-4 tabular-nums text-foreground/80">{inf.avgEng.toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {3 + leaderLimit < influencers.length && (
                    <div className="pt-4 flex justify-center">
                      <button
                        onClick={() => setLeaderLimit(l => l + 10)}
                        className="font-mono-ui text-[10px] tracking-[0.12em] uppercase px-4 py-2 border border-black/10 hover:border-black/40 transition-colors"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 6. Content Spotlight */}
            <section className="animate-fade-in">
              <div className="flex items-baseline justify-between mb-4">
                <span className="section-label">Content Spotlight</span>
                <span className="section-count">{topPostsGrid.length}</span>
              </div>
              {topPostsGrid.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No posts in the selected window.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topPostsGrid.map((p) => (
                    <ContentSpotlightCard key={p.id} p={p} />
                  ))}
                </div>
              )}
            </section>

            {activeClientId && <CreatorShareOfVoiceSection clientId={activeClientId} accent={accent} />}

            {/* 7. Inbound Creator Discovery */}
            {activeClientId && <InboundCreatorsSection clientId={activeClientId} accent={accent} />}
            </div>
          </>
        )}
      </DataStateWrapper>

      {/* Author drawer */}
      <Sheet open={!!drawerAuthor} onOpenChange={(o) => !o && setDrawerAuthor(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">{drawerAuthor}</SheetTitle>
          </SheetHeader>
          {drawerAuthorData && (
            <div className="mt-4 space-y-4">
              {/* Social profile links */}
              {drawerAuthorData.profile && (
                <div className="flex items-center gap-2 flex-wrap">
                  {drawerAuthorData.profile.instagram_url && (
                    <a href={drawerAuthorData.profile.instagram_url} target="_blank" rel="noreferrer"
                      className="w-8 h-8 flex items-center justify-center border border-black/10 hover:border-black/40 transition-colors"
                      title="Instagram">
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {drawerAuthorData.profile.tiktok_url && (
                    <a href={drawerAuthorData.profile.tiktok_url} target="_blank" rel="noreferrer"
                      className="w-8 h-8 flex items-center justify-center border border-black/10 hover:border-black/40 transition-colors font-mono-ui text-[10px] font-bold"
                      title="TikTok">
                      TT
                    </a>
                  )}
                  {drawerAuthorData.profile.youtube_url && (
                    <a href={drawerAuthorData.profile.youtube_url} target="_blank" rel="noreferrer"
                      className="w-8 h-8 flex items-center justify-center border border-black/10 hover:border-black/40 transition-colors"
                      title="YouTube">
                      <Youtube className="w-4 h-4" />
                    </a>
                  )}
                  {drawerAuthorData.profile.x_url && (
                    <a href={drawerAuthorData.profile.x_url} target="_blank" rel="noreferrer"
                      className="w-8 h-8 flex items-center justify-center border border-black/10 hover:border-black/40 transition-colors"
                      title="X (Twitter)">
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-black/10 p-3">
                  <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Followers</p>
                  <p className="font-display text-lg font-bold">{formatCount(drawerAuthorData.followers)}</p>
                  {drawerAuthorData.profile && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">Global (Lefty)</p>
                  )}
                </div>
                <div className="border border-black/10 p-3">
                  <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Total EMV</p>
                  <p className="font-display text-lg font-bold" style={{ color: GOLD }}>{formatMoney(drawerAuthorData.emv)}</p>
                </div>
                <div className="border border-black/10 p-3">
                  <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Posts</p>
                  <p className="font-display text-lg font-bold">{drawerAuthorData.posts}</p>
                </div>
                <div className="border border-black/10 p-3">
                  <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Avg Eng</p>
                  <p className="font-display text-lg font-bold">{drawerAuthorData.avgEng.toFixed(2)}%</p>
                </div>
              </div>

              {/* Static vs Video engagement rate comparison */}
              {drawerAuthorData.profile && (
                (drawerAuthorData.profile.static_eng_rate != null || drawerAuthorData.profile.video_eng_rate != null) && (
                  <div className="border border-black/10 p-4">
                    <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-3">Engagement rate by format</p>
                    {(() => {
                      const s = (drawerAuthorData.profile!.static_eng_rate ?? 0) * 100;
                      const v = (drawerAuthorData.profile!.video_eng_rate ?? 0) * 100;
                      const max = Math.max(s, v, 0.01);
                      return (
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-xs text-muted-foreground">Static</span>
                              <span className="font-display text-sm font-bold tabular-nums">{s.toFixed(2)}%</span>
                            </div>
                            <div className="h-2 bg-black/[0.06] overflow-hidden">
                              <div className="h-full" style={{ width: `${(s / max) * 100}%`, backgroundColor: accent }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-xs text-muted-foreground">Video</span>
                              <span className="font-display text-sm font-bold tabular-nums">{v.toFixed(2)}%</span>
                            </div>
                            <div className="h-2 bg-black/[0.06] overflow-hidden">
                              <div className="h-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: GOLD }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )
              )}

              <div>
                <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Posts</p>
                <div className="divide-y divide-black/[0.06] border border-black/10">
                  {drawerPostsLoading ? (
                    <div className="p-3 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                  ) : drawerPosts.map(p => (
                      <a
                        key={p.id}
                        href={p.post_link ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2 hover:bg-black/[0.03]"
                      >
                        <NetworkBadge network={p.network ?? ''} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{p.campaign_name ?? '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{p.posted_at?.slice(0, 10)}</p>
                        </div>
                        <span className="font-display text-sm font-bold tabular-nums">{formatMoney(p.emv ?? 0)}</span>
                        {p.post_link && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
                      </a>
                    ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ---------- expanded campaign panel ----------
interface CampaignDetail {
  posts: number; reach: number; emv: number;
  top_authors: { name: string; emv: number; reach: number; posts: number }[];
  top_posts: { id: string; post_link: string | null; author_name: string | null; network: string | null; reach: number | null; emv: number | null }[];
}

const CampaignExpandedPanel = ({ clientId, campaignName, accent, network, start, end }: { clientId: string; campaignName: string; accent: string; network: string; start: string | null; end: string | null }) => {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc('influencer_campaign_detail_secure' as any, {
        p_client_id: clientId, p_campaign: campaignName, p_start: start, p_end: end,
        p_network: network === 'all' ? null : network,
      });
      if (cancelled) return;
      setDetail((data as unknown as CampaignDetail) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId, campaignName, network, start, end]);

  if (loading) return <Skeleton className="h-[180px] w-full" />;
  const totalPosts = detail?.posts ?? 0;
  const totalReach = detail?.reach ?? 0;
  const totalEmv = detail?.emv ?? 0;
  const topAuthors = detail?.top_authors ?? [];
  const topPosts = detail?.top_posts ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tracked Posts', value: totalPosts.toLocaleString() },
          { label: 'Tracked Reach', value: formatReach(totalReach) },
          { label: 'Tracked EMV', value: formatMoney(totalEmv) },
        ].map(s => (
          <div key={s.label} className="border border-black/[0.08] bg-white px-3 py-2">
            <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">{s.label}</p>
            <p className="font-display text-base font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Top Influencers</p>
          <div className="border border-black/[0.08] divide-y divide-black/[0.06] bg-white">
            {topAuthors.map(a => (
              <div key={a.name} className="px-3 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.posts} posts · {formatReach(a.reach)}</p>
                </div>
                <span className="font-display text-sm font-bold" style={{ color: accent }}>{formatMoney(a.emv)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Top Posts</p>
          <div className="border border-black/[0.08] divide-y divide-black/[0.06] bg-white">
            {topPosts.map((p, i) => (
              <LinkPreviewTrigger
                key={p.id}
                url={p.post_link ?? undefined}
                meta={[
                  { label: 'Campaign', value: campaignName },
                  { label: 'Author', value: p.author_name ?? '—' },
                  { label: 'EMV', value: formatMoney(p.emv ?? 0) },
                ]}
                className="flex w-full items-center gap-3 px-3 py-2 hover:bg-black/[0.03] text-left"
              >
                <span className="font-mono-ui text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{p.author_name ?? 'Creator'}</p>
                  <p className="text-[10px] text-muted-foreground">{normalizeNetwork(p.network)} · {formatReach(p.reach ?? 0)}</p>
                </div>
                <span className="font-display text-xs font-bold tabular-nums">{formatMoney(p.emv ?? 0)}</span>
                {p.post_link && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
              </LinkPreviewTrigger>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- inbound creator discovery ----------
interface LaunchmetricsSummary {
  total_mentions: number | null;
  inbound_creators: number | null;
  activated_creators: number | null;
  inbound_miv: number | null;
  activation_source?: 'kin' | 'lefty' | null;
  tracked_not_activated?: number | null;
}

interface InboundCreator {
  voice_name: string | null;
  source_handle: string | null;
  voice_type: string | null;
  channel: string | null;
  mentions: number | null;
  total_reach: number | null;
  total_miv: number | null;
  in_lefty: boolean | null;
  latest_post: string | null;
}

const VOICE_TYPE_STYLES: Record<string, string> = {
  influencer: 'bg-[#1B2B8A]/10 text-[#1B2B8A]',
  celebrity: 'bg-[#C9A961]/15 text-[#8A6A2E]',
  brand: 'bg-black/[0.06] text-foreground/70',
  media: 'bg-black text-white',
};

const ChannelIcon = ({ channel }: { channel: string | null }) => {
  const c = (channel ?? '').toLowerCase();
  if (c.includes('instagram')) return <Instagram className="w-3.5 h-3.5 text-[#C13584]" />;
  if (c.includes('tiktok')) return <Music2 className="w-3.5 h-3.5 text-foreground" />;
  if (c.includes('youtube')) return <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />;
  if (c.includes('twitter') || c === 'x') return <Twitter className="w-3.5 h-3.5 text-foreground/70" />;
  return <Globe className="w-3.5 h-3.5 text-muted-foreground" />;
};

const relativeDate = (v: string | null | undefined) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return formatDistanceToNowStrict(d, { addSuffix: true });
};

interface KinSovBrand {
  brand: string; is_own: boolean; emv: number; impressions: number; posts: number;
  emv_share: number; impressions_share: number; rank: number; prior_emv_share: number | null;
  avg_monthly_creators?: number | null; retention_pct?: number | null; emv_per_creator_month?: number | null;
}
interface KinSov {
  panel_name: string; category: string;
  period: { from: string; to: string; months: number; includes_partial_month: boolean };
  prior_period: { from: string; to: string };
  brands: KinSovBrand[];
  own: { brand: string; emv_share: number; rank: number; prior_emv_share: number | null; delta_pts: number | null; brand_count: number; avg_monthly_creators?: number | null; peer_median_creators?: number | null; retention_pct?: number | null; peer_median_retention_pct?: number | null } | null;
  trend: { month: string; shares: Record<string, number> }[];
  views: { category: string; label: string }[];
}

const SOV_DASHES = ['6 3', '2 3', '10 4 2 4'];

const CreatorShareOfVoiceSection = ({ clientId, accent }: { clientId: string; accent: string }) => {
  const { isAllTime, effectiveFrom, effectiveTo } = useWeek();
  const [category, setCategory] = useState('');
  const [data, setData] = useState<KinSov | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: d, error } = await supabase.rpc('kin_share_of_voice_secure' as any, {
        p_client_id: clientId, p_category: category,
        ...(isAllTime ? {} : { p_start: effectiveFrom, p_end: effectiveTo }),
      });
      if (cancelled) return;
      setData(error ? null : ((d as unknown as KinSov) ?? null));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId, category, isAllTime, effectiveFrom, effectiveTo]);

  const brands = useMemo(() => [...(data?.brands ?? [])].sort((a, b) => a.rank - b.rank), [data]);
  const topComps = useMemo(() => brands.filter(b => !b.is_own).slice(0, 3).map(b => b.brand), [brands]);
  const trendData = useMemo(() => (data?.trend ?? []).map(t => ({ month: t.month, ...t.shares })), [data]);

  if (loading) {
    return (
      <section className="animate-fade-in">
        <div className="flex items-baseline justify-between mb-4"><span className="section-label">Creator Share of Voice</span></div>
        <Skeleton className="h-[280px] w-full" />
      </section>
    );
  }
  if (!data || brands.length === 0) return null;

  const own = data.own;
  const leader = brands[0];
  const maxShare = Math.max(...brands.map(b => Number(b.emv_share) || 0), 0.0001);
  const fmtMonth = (s: string) => { try { return format(parseISO(s.length === 7 ? `${s}-01` : s), 'MMM yyyy'); } catch { return s; } };
  const fmtShort = (s: string) => { try { return format(parseISO(`${s}-01`), 'MMM yy'); } catch { return s; } };
  const activeCat = category || data.category || '';

  return (
    <section className="animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <span className="section-label">Creator Share of Voice</span>
          <p className="text-xs text-muted-foreground mt-1">
            {`Share of creator EMV across Kin's ${data.panel_name} industry panel · ${fmtMonth(data.period.from)} – ${fmtMonth(data.period.to)}`}
            {data.period.includes_partial_month ? ' (current month to date)' : ''}
          </p>
        </div>
        {data.views?.length > 0 && (
          <div className="inline-flex border border-black/[0.08] bg-white">
            {data.views.map(v => {
              const on = v.category === activeCat;
              return (
                <button key={v.category} onClick={() => setCategory(v.category)}
                  className={`font-mono-ui text-[10px] tracking-[0.14em] uppercase px-3 py-1.5 transition-colors ${on ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  style={on ? { backgroundColor: accent } : undefined}>
                  {v.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-black/[0.08] bg-white px-4 py-3">
          <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">{own ? `${own.brand} share` : 'Share'}</p>
          <p className="font-display text-xl font-bold tabular-nums" style={{ color: accent }}>{own ? `${own.emv_share}%` : '—'}</p>
          {own && own.delta_pts != null && (
            <p className={`text-[11px] tabular-nums ${own.delta_pts > 0 ? 'text-emerald-600' : own.delta_pts < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {`${own.delta_pts > 0 ? '+' : ''}${own.delta_pts} pts vs prior period`}
            </p>
          )}
        </div>
        <div className="border border-black/[0.08] bg-white px-4 py-3">
          <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Rank</p>
          <p className="font-display text-xl font-bold tabular-nums">{own ? `#${own.rank} of ${own.brand_count}` : '—'}</p>
        </div>
        <div className="border border-black/[0.08] bg-white px-4 py-3">
          <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Creators / month</p>
          <p className="font-display text-xl font-bold tabular-nums">{own?.avg_monthly_creators != null ? formatCount(own.avg_monthly_creators) : '—'}</p>
          {own?.peer_median_creators != null && <p className="text-[11px] text-muted-foreground tabular-nums">Peer median {formatCount(own.peer_median_creators)}</p>}
        </div>
        <div className="border border-black/[0.08] bg-white px-4 py-3">
          <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">Creator retention</p>
          <p className="font-display text-xl font-bold tabular-nums">{own?.retention_pct != null ? `${own.retention_pct}%` : '—'}</p>
          {own?.peer_median_retention_pct != null && <p className="text-[11px] text-muted-foreground tabular-nums">Peer median {own.peer_median_retention_pct}%</p>}
        </div>
      </div>

      <div className="border border-black/[0.08] bg-white px-4 py-3 mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground text-left">
              <th className="py-2 pr-2 w-8 font-normal">#</th>
              <th className="py-2 pr-3 font-normal">Brand</th>
              <th className="py-2 pr-3 font-normal min-w-[160px]">Share</th>
              <th className="py-2 pr-3 font-normal text-right">EMV</th>
              <th className="py-2 pr-3 font-normal text-right">Creators/mo</th>
              <th className="py-2 pr-3 font-normal text-right">Retention</th>
              <th className="py-2 font-normal text-right">EMV per creator</th>
            </tr>
          </thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.brand} className={`border-t border-black/[0.05] ${b.is_own ? 'font-bold' : ''}`}>
                <td className="py-2 pr-2 font-mono-ui text-[10px] text-muted-foreground tabular-nums">{b.rank}</td>
                <td className="py-2 pr-3 truncate max-w-[180px]">{b.brand}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-black/[0.04]">
                      <div className="h-full" style={{ width: `${((Number(b.emv_share) || 0) / maxShare) * 100}%`, backgroundColor: b.is_own ? accent : 'rgba(0,0,0,0.25)' }} />
                    </div>
                    <span className="text-xs tabular-nums w-12 text-right">{`${b.emv_share}%`}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-xs">{formatMoney(b.emv)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-xs">{b.avg_monthly_creators != null ? formatCount(b.avg_monthly_creators) : '—'}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-xs">{b.retention_pct != null ? `${b.retention_pct}%` : '—'}</td>
                <td className="py-2 text-right tabular-nums text-xs">{b.emv_per_creator_month != null ? formatMoney(b.emv_per_creator_month) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trendData.length > 0 && (
        <div className="border border-black/[0.08] bg-white px-4 py-3 mb-3">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={fmtShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(l) => fmtShort(String(l))} formatter={(v: number, n: string) => [`${v}% share`, n]} />
              {own && <Line type="monotone" dataKey={own.brand} stroke={accent} strokeWidth={3} dot={false} />}
              {topComps.map((c, i) => (
                <Line key={c} type="monotone" dataKey={c} stroke="rgba(0,0,0,0.4)" strokeWidth={1.25} strokeDasharray={SOV_DASHES[i]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Source: Kin industry panel (independent creator benchmark, EMV as calculated by Kin). Monthly data, so selected dates are rounded to whole months. Retention = share of a brand's creators who post again the following quarter.
      </p>
    </section>
  );
};

const InboundCreatorsSection = ({ clientId, accent }: { clientId: string; accent: string }) => {
  const [summary, setSummary] = useState<LaunchmetricsSummary | null>(null);
  const [creators, setCreators] = useState<InboundCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mivSort, setMivSort] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data: sumData, error: sumErr } = await supabase.rpc('launchmetrics_social_summary', { p_client_id: clientId });
        if (sumErr) throw sumErr;
        const s: LaunchmetricsSummary | null = Array.isArray(sumData) ? sumData[0] ?? null : sumData ?? null;
        if (cancelled) return;
        setSummary(s);
        if (!s || !Number(s.total_mentions)) {
          setCreators([]);
          setLoading(false);
          return;
        }
        const { data: cData, error: cErr } = await supabase.rpc('launchmetrics_inbound_creators', { p_client_id: clientId, p_limit: 25 });
        if (cErr) throw cErr;
        if (cancelled) return;
        setCreators(Array.isArray(cData) ? (cData as InboundCreator[]) : []);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load inbound creators');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <section className="animate-fade-in">
        <div className="flex items-baseline justify-between mb-4">
          <span className="section-label">Inbound Creator Discovery</span>
        </div>
        <Skeleton className="h-[240px] w-full" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="animate-fade-in">
        <div className="flex items-baseline justify-between mb-4">
          <span className="section-label">Inbound Creator Discovery</span>
        </div>
        <p className="text-xs text-destructive py-6 text-center">{error}</p>
      </section>
    );
  }

  // Hide the entire section when the client has no tracked mentions.
  if (!summary || !Number(summary.total_mentions)) return null;

  const platform = summary.activation_source === 'kin' ? 'Kin' : 'Lefty';

  const sorted = [...creators].sort((a, b) =>
    mivSort === 'desc' ? (b.total_miv ?? 0) - (a.total_miv ?? 0) : (a.total_miv ?? 0) - (b.total_miv ?? 0)
  );

  const stats = [
    { label: 'Inbound Creators', value: formatCount(summary.inbound_creators) },
    { label: `Activated in ${platform}`, value: formatCount(summary.activated_creators) },
    { label: 'Inbound MIV', value: formatMoney(summary.inbound_miv) },
    ...(summary.activation_source === 'kin'
      ? [{ label: 'Tracked in Kin, not activated', value: formatCount(summary.tracked_not_activated) }]
      : []),
  ];

  return (
    <section className="animate-fade-in">
      <div className="flex items-baseline justify-between mb-1">
        <span className="section-label">Inbound Creator Discovery</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Organic mentions from creators outside your activated campaigns.</p>

      <div className={summary.activation_source === 'kin' ? 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6' : 'grid grid-cols-3 gap-4 mb-6'}>
        {stats.map(s => (
          <div key={s.label} className="border border-black/[0.08] bg-white px-4 py-3">
            <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground">{s.label}</p>
            <p className="font-display text-xl font-bold tabular-nums" style={s.label === 'Inbound MIV' ? { color: accent } : undefined}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border border-black/[0.08] bg-white">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-black/10">
              <th className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 px-4 text-left">Creator</th>
              <th className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 px-4 text-left">Type</th>
              <th className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 px-4 text-left">Channel</th>
              <th className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 px-4 text-right">Mentions</th>
              <th className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 px-4 text-right">Total Reach</th>
              <th className="py-2 px-4 text-right">
                <button
                  onClick={() => setMivSort(d => (d === 'desc' ? 'asc' : 'desc'))}
                  className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground"
                >
                  Total MIV
                  {mivSort === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>
              </th>
              <th className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground py-2 px-4 text-right">Latest Post</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No inbound creators found.</td></tr>
            )}
            {sorted.map((c, i) => {
              const vt = (c.voice_type ?? '').toLowerCase();
              const vtLabel = c.voice_type
                ? c.voice_type.charAt(0).toUpperCase() + c.voice_type.slice(1).toLowerCase()
                : '—';
              return (
                <tr key={`${c.voice_name ?? 'creator'}-${i}`} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors">
                  <td className="py-3 px-4 max-w-[220px]">
                    <p className="font-medium text-foreground truncate">{c.voice_name ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.source_handle ?? ''}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-mono-ui text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 whitespace-nowrap ${VOICE_TYPE_STYLES[vt] ?? 'bg-black/[0.06] text-foreground/70'}`}>
                      {vtLabel}
                    </span>
                    {c.in_lefty && (
                      <span className="ml-1.5 font-mono-ui text-[8px] tracking-[0.12em] uppercase px-1.5 py-0.5 border border-black/15 text-muted-foreground whitespace-nowrap">
                        Activated in {platform}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span title={c.channel ?? undefined} className="inline-flex"><ChannelIcon channel={c.channel} /></span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-foreground/80">{c.mentions ?? 0}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-foreground/80">{formatReach(c.total_reach)}</td>
                  <td className="py-3 px-4 text-right font-display font-bold tabular-nums" style={{ color: GOLD }}>
                    {formatMoney(c.total_miv)}
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] text-muted-foreground whitespace-nowrap">{relativeDate(c.latest_post)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default InfluencerIntelligenceTab;
