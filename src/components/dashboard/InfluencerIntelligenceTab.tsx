import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, BarChart, Bar, LabelList, Cell,
} from 'recharts';
import { ChevronDown, ChevronUp, ExternalLink, Search, X, Instagram, Youtube, Twitter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { formatMoney, formatReach, formatCount } from '@/lib/format';
import DataStateWrapper from './DataStateWrapper';
import EmptyState from './EmptyState';
import Sparkline from './Sparkline';
import PaginationControls from './PaginationControls';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format as formatDate } from 'date-fns';
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

type DateRangeKey = '30d' | '90d' | '12mo' | 'all';
type NetworkKey = 'all' | 'Instagram' | 'TikTok';

// ---------- helpers ----------
const normalizeNetwork = (n: string | null): string => {
  if (!n) return 'Other';
  const v = n.toLowerCase();
  if (v.includes('insta')) return 'Instagram';
  if (v.includes('tiktok') || v === 'tt') return 'TikTok';
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
  dateRange: DateRangeKey;
  setDateRange: (k: DateRangeKey) => void;
  network: NetworkKey;
  setNetwork: (n: NetworkKey) => void;
  campaigns: string[];
  selectedCampaigns: string[];
  setSelectedCampaigns: (c: string[]) => void;
}
const FilterBar = ({
  dateRange, setDateRange, network, setNetwork,
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
          <Pill value="30d" active={dateRange === '30d'} onClick={setDateRange} label="30D" />
          <Pill value="90d" active={dateRange === '90d'} onClick={setDateRange} label="90D" />
          <Pill value="12mo" active={dateRange === '12mo'} onClick={setDateRange} label="12MO" />
          <Pill value="all" active={dateRange === 'all'} onClick={setDateRange} label="All Time" />
        </div>
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

// ---------- main tab ----------
const InfluencerIntelligenceTab = () => {
  const { activeClientId, refreshKey } = useWeek();
  const { clientColor, isAdmin } = useAdmin();
  const accent = clientColor || ROYAL;

  const [posts, setPosts] = useState<LeftyPost[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [monthlyPerf, setMonthlyPerf] = useState<LeftyMonthlyPerf[]>([]);
  const [influencerProfiles, setInfluencerProfiles] = useState<Map<string, LeftyInfluencer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [dateRange, setDateRange] = useState<DateRangeKey>('12mo');
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

  // Fetch all data (no row caps)
  useEffect(() => {
    if (!activeClientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      const PAGE = 1000;
      const all: LeftyPost[] = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error: err } = await supabase
          .from('lefty_posts')
          .select('id, campaign_name, network, author_name, followers, impressions, reach, emv, engagement_rate, post_link, posted_at, likes, comments, views, shares, meta_id, caption_excerpt')
          .eq('client_id', activeClientId)
          .order('posted_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (cancelled) return;
        if (err) { setError(true); setLoading(false); return; }
        const batch = (data as LeftyPost[]) ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
        if (from > 100000) break;
      }
      const { data: pData } = await supabase
        .from('partnerships')
        .select('id, partner_name, type, status, description, emv_generated, start_date, end_date, notes')
        .eq('client_id', activeClientId)
        .order('created_at', { ascending: false });

      // Lefty monthly rollup (may not exist for every client — silent fallback)
      const { data: mpData } = await supabase
        .from('lefty_monthly_perf')
        .select('client_id, month_start, active_influencers, posts, impressions, engagements, est_reach, eng_rate, emv')
        .eq('client_id', activeClientId)
        .order('month_start', { ascending: true });

      // Influencer profiles keyed by meta_id
      const metaIds = Array.from(new Set(all.map(p => p.meta_id).filter((x): x is string => !!x)));
      let profiles: LeftyInfluencer[] = [];
      if (metaIds.length > 0) {
        // Chunk to avoid URL length issues
        const CHUNK = 200;
        for (let i = 0; i < metaIds.length; i += CHUNK) {
          const slice = metaIds.slice(i, i + CHUNK);
          const { data: infData } = await supabase
            .from('lefty_influencers')
            .select('meta_id, name, instagram_url, tiktok_url, youtube_url, x_url, followers, blended_eng_rate, static_eng_rate, video_eng_rate, emv, est_reach')
            .in('meta_id', slice);
          if (infData) profiles = profiles.concat(infData as LeftyInfluencer[]);
        }
      }

      if (cancelled) return;
      setPosts(all);
      setPartnerships((pData ?? []) as Partnership[]);
      setMonthlyPerf((mpData ?? []) as LeftyMonthlyPerf[]);
      const profMap = new Map<string, LeftyInfluencer>();
      profiles.forEach(p => profMap.set(p.meta_id, p));
      setInfluencerProfiles(profMap);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, refreshKey]);


  // Distinct campaigns from posts
  const campaignList = useMemo(() => {
    const set = new Set<string>();
    posts.forEach(p => { if (p.campaign_name) set.add(p.campaign_name); });
    return Array.from(set).sort();
  }, [posts]);

  // Filtered posts (current period)
  const { filteredPosts, priorPosts } = useMemo(() => {
    const now = new Date();
    let fromIso = '';
    let priorFromIso = '';
    let priorToIso = '';
    if (dateRange !== 'all') {
      const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      fromIso = daysAgoIso(days);
      priorFromIso = daysAgoIso(days * 2);
      priorToIso = fromIso;
    }
    const matches = (p: LeftyPost, from: string, to?: string) => {
      if (!p.posted_at) return false;
      const iso = p.posted_at.slice(0, 10);
      if (from && iso < from) return false;
      if (to && iso >= to) return false;
      if (network !== 'all' && normalizeNetwork(p.network) !== network) return false;
      if (selectedCampaigns.length > 0 && (!p.campaign_name || !selectedCampaigns.includes(p.campaign_name))) return false;
      return true;
    };
    const cur = posts.filter(p => matches(p, fromIso));
    const prev = dateRange === 'all' ? [] : posts.filter(p => matches(p, priorFromIso, priorToIso));
    return { filteredPosts: cur, priorPosts: prev };
  }, [posts, dateRange, network, selectedCampaigns]);

  // Monthly aggregates over the last 6 months (for KPI sparklines) — from all posts
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

  const monthly = useMemo(() => {
    const map = new Map<string, { posts: number; reach: number; emv: number; authors: Set<string>; engSum: number; engN: number }>();
    posts.forEach(p => {
      if (!p.posted_at) return;
      const k = monthKey(p.posted_at);
      const cur = map.get(k) ?? { posts: 0, reach: 0, emv: 0, authors: new Set(), engSum: 0, engN: 0 };
      cur.posts += 1;
      cur.reach += p.reach ?? 0;
      cur.emv += p.emv ?? 0;
      if (p.author_name) cur.authors.add(p.author_name);
      if (typeof p.engagement_rate === 'number' && p.engagement_rate > 0) {
        cur.engSum += p.engagement_rate; cur.engN += 1;
      }
      map.set(k, cur);
    });
    return map;
  }, [posts]);

  const spark = (metric: 'posts' | 'reach' | 'emv' | 'authors' | 'eng'): number[] =>
    sixMonthKeys.map(k => {
      const v = monthly.get(k);
      if (!v) return 0;
      if (metric === 'authors') return v.authors.size;
      if (metric === 'eng') return v.engN > 0 ? (v.engSum / v.engN) * 100 : 0;
      return v[metric];
    });

  // KPI totals
  const kpis = useMemo(() => {
    const sumReach = (arr: LeftyPost[]) => arr.reduce((s, p) => s + (p.reach ?? 0), 0);
    const sumEmv = (arr: LeftyPost[]) => arr.reduce((s, p) => s + (p.emv ?? 0), 0);
    const avgEng = (arr: LeftyPost[]) => {
      const vals = arr.map(p => p.engagement_rate).filter((v): v is number => typeof v === 'number' && v > 0);
      return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) * 100 : 0;
    };
    const distinctAuthors = (arr: LeftyPost[]) => new Set(arr.map(p => p.author_name).filter(Boolean)).size;
    return {
      posts: { cur: filteredPosts.length, prior: priorPosts.length },
      reach: { cur: sumReach(filteredPosts), prior: sumReach(priorPosts) },
      emv: { cur: sumEmv(filteredPosts), prior: sumEmv(priorPosts) },
      eng: { cur: avgEng(filteredPosts), prior: avgEng(priorPosts) },
      authors: { cur: distinctAuthors(filteredPosts), prior: distinctAuthors(priorPosts) },
    };
  }, [filteredPosts, priorPosts]);

  // Engagement helper (likes + comments + shares; views tracked separately)
  const engagementsOf = (p: LeftyPost) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);

  // Engagement breakdown totals (from filtered posts, no row caps)
  const engagementTotals = useMemo(() => {
    let likes = 0, comments = 0, views = 0, shares = 0;
    filteredPosts.forEach(p => {
      likes += p.likes ?? 0;
      comments += p.comments ?? 0;
      views += p.views ?? 0;
      shares += p.shares ?? 0;
    });
    return { likes, comments, views, shares, engagements: likes + comments + shares };
  }, [filteredPosts]);

  // Monthly series for chart (filtered).
  // Prefers lefty_monthly_perf when neutral filters, otherwise computes from posts.
  const filteredMonthly = useMemo(() => {
    const neutralFilters = network === 'all' && selectedCampaigns.length === 0;
    const fromIso = dateRange === 'all' ? '' :
      daysAgoIso(dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365);

    let rows: { key: string; posts: number; reach: number; emv: number; engagements: number }[] = [];

    if (neutralFilters && monthlyPerf.length > 0) {
      const inWindow = monthlyPerf.filter(m => !fromIso || (m.month_start ?? '') >= fromIso.slice(0, 7));
      rows = inWindow.map(m => ({
        key: monthKey(m.month_start ?? ''),
        posts: m.posts ?? 0,
        reach: m.est_reach ?? 0,
        emv: m.emv ?? 0,
        engagements: m.engagements ?? 0,
      }));
    } else {
      const map = new Map<string, { posts: number; reach: number; emv: number; engagements: number }>();
      filteredPosts.forEach(p => {
        if (!p.posted_at) return;
        const k = monthKey(p.posted_at);
        const cur = map.get(k) ?? { posts: 0, reach: 0, emv: 0, engagements: 0 };
        cur.posts += 1;
        cur.reach += p.reach ?? 0;
        cur.emv += p.emv ?? 0;
        cur.engagements += engagementsOf(p);
        map.set(k, cur);
      });
      rows = Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }));
    }

    if (rows.length === 0) return [];
    rows.sort((a, b) => a.key.localeCompare(b.key));

    // Fill missing months with zeros so the axis is continuous.
    const startKey = fromIso ? fromIso.slice(0, 7) : rows[0].key;
    const endKey = monthKey(new Date().toISOString().slice(0, 10));
    const allKeys = monthRange(startKey < rows[0].key ? startKey : rows[0].key, endKey > rows[rows.length - 1].key ? endKey : rows[rows.length - 1].key);
    const byKey = new Map(rows.map(r => [r.key, r]));
    return allKeys.map(k => {
      const r = byKey.get(k) ?? { key: k, posts: 0, reach: 0, emv: 0, engagements: 0 };
      return { month: monthLabel(k), key: k, ...r };
    });
  }, [filteredPosts, monthlyPerf, network, selectedCampaigns, dateRange]);

  // Campaign aggregates (from filtered posts)
  const campaignAgg = useMemo(() => {
    const map = new Map<string, { name: string; posts: number; reach: number; emv: number; authors: Set<string>; firstDate: string; lastDate: string; monthly: Map<string, { reach: number; emv: number }> }>();
    filteredPosts.forEach(p => {
      const name = (p.campaign_name ?? '').trim();
      if (!name) return;
      const cur = map.get(name) ?? { name, posts: 0, reach: 0, emv: 0, authors: new Set(), firstDate: '', lastDate: '', monthly: new Map() };
      cur.posts += 1;
      cur.reach += p.reach ?? 0;
      cur.emv += p.emv ?? 0;
      if (p.author_name) cur.authors.add(p.author_name);
      if (p.posted_at) {
        const iso = p.posted_at.slice(0, 10);
        if (!cur.firstDate || iso < cur.firstDate) cur.firstDate = iso;
        if (!cur.lastDate || iso > cur.lastDate) cur.lastDate = iso;
        const mk = monthKey(p.posted_at);
        const m = cur.monthly.get(mk) ?? { reach: 0, emv: 0 };
        m.reach += p.reach ?? 0;
        m.emv += p.emv ?? 0;
        cur.monthly.set(mk, m);
      }
      map.set(name, cur);
    });
    return Array.from(map.values());
  }, [filteredPosts]);

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
          influencers: c.authors.size,
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

  // Influencer leaderboard (enriched with lefty_influencers profile via meta_id)
  const influencers = useMemo(() => {
    const map = new Map<string, { name: string; metaId: string | null; postsFollowers: number; posts: number; reach: number; emv: number; engSum: number; engN: number; postsList: LeftyPost[] }>();
    filteredPosts.forEach(p => {
      const name = (p.author_name ?? '').trim();
      if (!name) return;
      const cur = map.get(name) ?? { name, metaId: null, postsFollowers: 0, posts: 0, reach: 0, emv: 0, engSum: 0, engN: 0, postsList: [] };
      cur.postsFollowers = Math.max(cur.postsFollowers, p.followers ?? 0);
      if (!cur.metaId && p.meta_id) cur.metaId = p.meta_id;
      cur.posts += 1;
      cur.reach += p.reach ?? 0;
      cur.emv += p.emv ?? 0;
      if (typeof p.engagement_rate === 'number' && p.engagement_rate > 0) { cur.engSum += p.engagement_rate; cur.engN += 1; }
      cur.postsList.push(p);
      map.set(name, cur);
    });
    return Array.from(map.values())
      .map(x => {
        const profile = x.metaId ? influencerProfiles.get(x.metaId) ?? null : null;
        // Prefer authoritative followers from lefty_influencers when available.
        const followers = profile?.followers ?? x.postsFollowers;
        return { ...x, followers, profile, avgEng: x.engN > 0 ? (x.engSum / x.engN) * 100 : 0 };
      })
      .sort((a, b) => b.emv - a.emv);
  }, [filteredPosts, influencerProfiles]);

  const topPostsGrid = useMemo(
    () => [...filteredPosts].sort((a, b) => (b.emv ?? 0) - (a.emv ?? 0)).slice(0, 12),
    [filteredPosts]
  );

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
        {posts.length === 0 ? (
          <EmptyState icon="📣" title="No influencer data yet" description="Once posts are synced, the intelligence view will populate here." />
        ) : (
          <>
            {activeClientId && (
              <InfluencerSummarySection clientId={activeClientId} accent={accent} isAdmin={isAdmin} />
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
              dateRange={dateRange} setDateRange={setDateRange}
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
                                    campaignName={r.name}
                                    posts={filteredPosts.filter(p => p.campaign_name === r.name)}
                                    accent={accent}
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
                <span className="section-count">{influencers.length}</span>
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
                    <LinkPreviewTrigger
                      key={p.id}
                      url={p.post_link ?? undefined}
                      meta={[
                        { label: 'Author', value: p.author_name ?? '—' },
                        { label: 'Campaign', value: p.campaign_name ?? '—' },
                        { label: 'Network', value: normalizeNetwork(p.network) },
                        { label: 'EMV', value: formatMoney(p.emv ?? 0) },
                        { label: 'Reach', value: formatReach(p.reach ?? 0) },
                      ]}
                      className="block bg-card border border-black/10 p-5 text-left hover:border-[#1B2B8A]/40 hover:-translate-y-0.5 transition-all group"
                    >
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
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/[0.06]">
                        <div>
                          <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">Reach</p>
                          <p className="font-display text-lg font-bold tabular-nums">{formatReach(p.reach ?? 0)}</p>
                        </div>
                        <div>
                          <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</p>
                          <p className="font-display text-lg font-bold tabular-nums" style={{ color: GOLD }}>{formatMoney(p.emv ?? 0)}</p>
                        </div>
                      </div>
                    </LinkPreviewTrigger>
                  ))}
                </div>
              )}
            </section>
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
                  {drawerAuthorData.postsList
                    .sort((a, b) => (b.emv ?? 0) - (a.emv ?? 0))
                    .map(p => (
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
const CampaignExpandedPanel = ({ campaignName, posts, accent }: { campaignName: string; posts: LeftyPost[]; accent: string }) => {
  const totalPosts = posts.length;
  const totalReach = posts.reduce((s, p) => s + (p.reach ?? 0), 0);
  const totalEmv = posts.reduce((s, p) => s + (p.emv ?? 0), 0);

  const byAuthor = new Map<string, { name: string; emv: number; reach: number; posts: number }>();
  posts.forEach(p => {
    const k = p.author_name ?? '—';
    const cur = byAuthor.get(k) ?? { name: k, emv: 0, reach: 0, posts: 0 };
    cur.emv += p.emv ?? 0; cur.reach += p.reach ?? 0; cur.posts += 1;
    byAuthor.set(k, cur);
  });
  const topAuthors = Array.from(byAuthor.values()).sort((a, b) => b.emv - a.emv).slice(0, 5);
  const topPosts = [...posts].sort((a, b) => (b.emv ?? 0) - (a.emv ?? 0)).slice(0, 5);

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

// ---------- AI Summary & Recommendations ----------
interface InfluencerSummaryRow {
  headline: string | null;
  narrative: string | null;
  drivers: string[] | null;
  watch_items: string[] | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
}

const fmtSummaryDate = (v: string | null | undefined) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : formatDate(d, 'MMM d, yyyy');
};
const fmtPeriod = (v: string | null | undefined) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : formatDate(d, 'MMM d');
};

const InfluencerSummarySection = ({
  clientId, accent, isAdmin,
}: { clientId: string; accent: string; isAdmin: boolean }) => {
  const [row, setRow] = useState<InfluencerSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmpty(null);
    (async () => {
      try {
        const { data, error: e } = await supabase
          .from('ai_summaries')
          .select('headline, narrative, drivers, watch_items, period_start, period_end, created_at')
          .eq('client_id', clientId)
          .eq('kind', 'influencer')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (e) throw e;
        setRow((data as InfluencerSummaryRow) ?? null);
      } catch (err) {
        if (!cancelled) { console.error('influencer summary load failed', err); setRow(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setEmpty(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('influencer-summary', {
        body: { client_id: clientId },
      });
      if (e) throw e;
      const payload = data as { summary?: InfluencerSummaryRow; empty?: boolean; message?: string };
      if (payload?.empty) {
        setEmpty(payload.message || 'No data available yet.');
        setRow(null);
      } else if (payload?.summary) {
        setRow(payload.summary);
      }
    } catch (err) {
      console.error('influencer-summary invoke failed', err);
      setError('Couldn\u2019t generate summary \u2014 try again');
    } finally {
      setGenerating(false);
    }
  };

  const drivers = (row?.drivers ?? []).filter(Boolean);
  const watch = (row?.watch_items ?? []).filter(Boolean);
  const narrativeParas = (row?.narrative ?? '').split(/\n{2,}/).filter(Boolean);
  const periodLabel = row
    ? [fmtPeriod(row.period_start), fmtPeriod(row.period_end)].filter(Boolean).join(' \u2013 ')
    : '';

  return (
    <section
      className="bg-card border border-black/10 rounded-sm overflow-hidden animate-fade-in"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <span
            className="text-[10px] font-bold tracking-[0.18em] uppercase font-mono-ui"
            style={{ color: accent }}
          >
            AI Summary &amp; Recommendations
          </span>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] tracking-[0.1em] uppercase"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Generating\u2026' : row ? 'Regenerate' : 'Generate'}
            </Button>
          )}
        </div>

        {loading || generating ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : empty ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{empty}</p>
          </div>
        ) : !row ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No AI summary yet for this client.</p>
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {row.headline && (
              <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight tracking-tight text-foreground">
                {row.headline}
              </h2>
            )}
            {narrativeParas.length > 0 && (
              <div className="space-y-3 max-w-3xl">
                {narrativeParas.map((p, i) => (
                  <p key={i} className="text-sm md:text-[15px] leading-relaxed text-foreground/85">
                    {p}
                  </p>
                ))}
              </div>
            )}
            {drivers.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-2 font-mono-ui">
                  Key Drivers
                </h3>
                <ul className="space-y-1.5">
                  {drivers.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <span style={{ color: accent }} className="font-mono mt-0.5">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {watch.length > 0 && (
              <div className="pl-3 border-l-2" style={{ borderColor: GOLD }}>
                <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2 font-mono-ui" style={{ color: GOLD }}>
                  Watch Items
                </h3>
                <ul className="space-y-1.5">
                  {watch.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <span style={{ color: GOLD }} className="font-mono mt-0.5">▲</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground pt-2 border-t border-black/10 font-mono-ui">
              Generated {fmtSummaryDate(row.created_at)}
              {periodLabel ? ` \u00b7 ${periodLabel}` : ''}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
};

export default InfluencerIntelligenceTab;
