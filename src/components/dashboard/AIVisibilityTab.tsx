import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';
import PaginationControls from './PaginationControls';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// Re-exported for any remaining consumers
export const ViewToggle = ({
  active, onToggle, options,
}: { active: string; onToggle: (v: string) => void; options?: string[] }) => {
  const opts = options ?? ['BY PLATFORM', 'HEATMAP', 'GAP ANALYSIS', 'TOP QUERIES + SOV'];
  return (
    <div className="flex gap-0 border border-border w-fit">
      {opts.map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className={cn(
            'px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors',
            active === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
};

// ---------- Types ----------
type PeriodKey = 'day' | 'week' | 'month' | 'custom';
type Platform =
  | 'all' | 'chatgpt' | 'perplexity' | 'google_ai' | 'google_ai_mode'
  | 'gemini' | 'claude' | 'copilot' | 'rufus';

interface KpiRow {
  metric: 'visibility' | 'sentiment' | 'position' | 'share_of_voice';
  current_value: number | null;
  previous_value: number | null;
}
interface CompetitiveTrendRow {
  date: string;
  brand_id: string;
  brand_name: string;
  is_client_brand: boolean;
  visibility: number | null;
  share_of_voice: number | null;
  sentiment: number | null;
  avg_position: number | null;
}
interface MatrixRow {
  platform: string;
  brand_id: string;
  brand_name: string;
  is_client_brand: boolean;
  visibility: number | null;
}
interface BrandSummaryRow {
  brand_id: string;
  brand_name: string;
  is_client_brand: boolean;
  visibility: number | null;
  sentiment: number | null;
  avg_position: number | null;
  share_of_voice: number | null;
  mention_count: number | null;
}
interface DomainRow {
  domain: string;
  classification: string | null;
  citation_count: number;
  retrieval_count: number;
  citation_rate: number | null;
  retrieved_percentage: number | null;
}
interface UrlRow {
  url: string;
  domain: string;
  classification: string | null;
  title: string | null;
  citation_count: number;
  retrieval_count: number;
  citation_rate: number | null;
}
interface QueryRow { query_text: string; freq: number }
interface ProductRow { product: string; freq: number }

interface PlatformScoreRow {
  platform: string;
  visibility: number | null;
  sentiment: number | null;
  avg_position: number | null;
  share_of_voice: number | null;
  mention_count: number | null;
}
interface PlatformCompetitiveRow {
  platform: string;
  brand_id: string;
  brand_name: string;
  is_client_brand: boolean;
  share_of_voice: number | null;
  visibility: number | null;
  mention_count: number | null;
}
interface GapDomainRow {
  domain: string;
  classification: string | null;
  citation_count: number;
  retrieval_count: number;
  competitor_brands: string[] | null;
}
interface GapUrlRow {
  url: string;
  domain: string;
  title: string | null;
  classification: string | null;
  citation_count: number;
  retrieval_count: number;
  competitor_brands: string[] | null;
}
interface ChatBrand { id?: string; name: string; position?: number | null; sentiment?: number | null }
interface ChatSource { url?: string; domain?: string; citationCount?: number | null; citationPosition?: number | null }
interface ChatRow {
  chat_id: string;
  date: string;
  platform: string;
  prompt_text: string;
  response_text: string;
  client_mentioned: boolean;
  client_position: number | null;
  brands_mentioned: ChatBrand[] | null;
  sources: ChatSource[] | null;
  queries: any;
  total_count: number;
}

// ---------- Helpers ----------
const PLATFORM_LABEL_MAP: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  google_ai_mode: 'Google AI Mode',
  gemini: 'Gemini',
  claude: 'Claude',
  copilot: 'Copilot',
  rufus: 'Rufus',
};
const platformLabel = (p: string) => PLATFORM_LABEL_MAP[p] || p;
const ALL_KNOWN_PLATFORMS = Object.keys(PLATFORM_LABEL_MAP);

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'all', label: 'All Platforms' },
  ...(ALL_KNOWN_PLATFORMS.map(p => ({ value: p as Platform, label: PLATFORM_LABEL_MAP[p] }))),
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function periodToRange(period: PeriodKey, custom: { from?: Date; to?: Date }) {
  const today = new Date();
  const end = isoDate(today);
  if (period === 'custom') {
    return {
      p_start: custom.from ? isoDate(custom.from) : end,
      p_end: custom.to ? isoDate(custom.to) : end,
    };
  }
  const daysBack = period === 'day' ? 1 : period === 'week' ? 7 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - (daysBack - 1));
  return { p_start: isoDate(start), p_end: end };
}

const fmtPct = (v: number | null | undefined, digits = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(digits)}%`;
const fmtPos = (v: number | null | undefined) =>
  v == null ? '—' : v.toFixed(1);
const fmtInt = (v: number | null | undefined) =>
  v == null ? '—' : Math.round(v).toString();
const fmtNum = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString();

function deltaPill(curr: number | null, prev: number | null, opts: {
  fmt: (n: number) => string;
  invert?: boolean;
}) {
  if (curr == null || prev == null) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  const diff = curr - prev;
  if (Math.abs(diff) < 1e-9) {
    return <span className="text-[10px] text-muted-foreground">— flat</span>;
  }
  const goodWhenUp = !opts.invert;
  const isUp = diff > 0;
  const isGood = goodWhenUp ? isUp : !isUp;
  const color = isGood ? 'text-positive' : 'text-negative';
  const arrow = isUp ? '▲' : '▼';
  return (
    <span className={cn('text-[10px] font-medium', color)}>
      {arrow} {opts.fmt(Math.abs(diff))}
    </span>
  );
}

const CLASSIFICATION_STYLES: Record<string, string> = {
  OWN: 'bg-[hsl(var(--chart-gold))] text-foreground',
  COMPETITOR: 'bg-destructive/15 text-destructive border border-destructive/30',
  EDITORIAL: 'bg-[hsl(225,70%,35%)] text-white',
  CORPORATE: 'bg-muted text-muted-foreground border border-border',
};
function ClassificationTag({ value }: { value: string | null }) {
  const v = (value || 'OTHER').toUpperCase();
  const cls = CLASSIFICATION_STYLES[v] || 'bg-muted text-muted-foreground';
  return (
    <span className={cn('inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5', cls)}>
      {v}
    </span>
  );
}

// ---------- Controls ----------
const PeriodControls = ({
  period, setPeriod, custom, setCustom, platform, setPlatform,
}: {
  period: PeriodKey; setPeriod: (p: PeriodKey) => void;
  custom: { from?: Date; to?: Date }; setCustom: (c: { from?: Date; to?: Date }) => void;
  platform: Platform; setPlatform: (p: Platform) => void;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <div className="flex gap-0 border border-border">
      {(['day', 'week', 'month', 'custom'] as PeriodKey[]).map(p => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={cn(
            'px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors',
            period === p ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p}
        </button>
      ))}
    </div>

    {period === 'custom' && (
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-[11px]">
              {custom.from ? format(custom.from, 'MMM d, yyyy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={custom.from} onSelect={(d) => setCustom({ ...custom, from: d ?? undefined })} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <span className="text-[10px] text-muted-foreground">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-[11px]">
              {custom.to ? format(custom.to, 'MMM d, yyyy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={custom.to} onSelect={(d) => setCustom({ ...custom, to: d ?? undefined })} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
    )}

    <div className="ml-auto">
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as Platform)}
        className="border border-border bg-background text-[11px] px-2 py-1.5 focus:outline-none"
      >
        {PLATFORMS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </div>
  </div>
);

// ---------- Platform Score Cards ----------
const PlatformScoreCards = ({ rows, loading }: { rows: PlatformScoreRow[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }
  const byPlatform = new Map(rows.map(r => [r.platform, r]));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {ALL_KNOWN_PLATFORMS.map(key => {
        const r = byPlatform.get(key);
        if (!r) {
          return (
            <div key={key} className="bg-card border border-border p-3 opacity-50">
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{platformLabel(key)}</p>
              <p className="text-xs text-muted-foreground mt-6">No data</p>
            </div>
          );
        }
        const score = Math.round((r.visibility ?? 0) * 100);
        let badge: { label: string; cls: string };
        if (score >= 40) badge = { label: 'STRONG', cls: 'bg-foreground text-background' };
        else if (score >= 20) badge = { label: 'MODERATE', cls: 'bg-corp-news' };
        else badge = { label: 'NEEDS WORK', cls: 'border border-destructive text-destructive' };
        return (
          <div key={key} className="bg-card border border-border p-3">
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{platformLabel(key)}</p>
            <p style={{ fontFamily: 'DM Mono, monospace' }} className="text-3xl font-bold mt-2 mb-1 text-foreground">{score}</p>
            <span className={cn('inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-1.5', badge.cls)}>
              {badge.label}
            </span>
            <p className="text-[9px] text-muted-foreground leading-tight">
              SoV {fmtPct(r.share_of_voice)} · Sent {fmtInt(r.sentiment)} · Pos {fmtPos(r.avg_position)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// ---------- KPI Cards ----------
const KpiCards = ({ rows, loading }: { rows: KpiRow[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }
  const byMetric = new Map(rows.map(r => [r.metric, r]));
  const cards: { key: KpiRow['metric']; label: string; fmt: (n: number | null | undefined) => string; deltaFmt: (n: number) => string; invert?: boolean }[] = [
    { key: 'visibility', label: 'Visibility', fmt: (v) => fmtPct(v), deltaFmt: (d) => `${(d * 100).toFixed(1)}pts` },
    { key: 'share_of_voice', label: 'Share of Voice', fmt: (v) => fmtPct(v), deltaFmt: (d) => `${(d * 100).toFixed(1)}pts` },
    { key: 'position', label: 'Avg Position', fmt: (v) => fmtPos(v), deltaFmt: (d) => d.toFixed(2), invert: true },
    { key: 'sentiment', label: 'Sentiment', fmt: (v) => fmtInt(v), deltaFmt: (d) => Math.round(d).toString() },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => {
        const r = byMetric.get(c.key);
        const curr = r?.current_value ?? null;
        const prev = r?.previous_value ?? null;
        return (
          <div key={c.key} className="bg-card border border-border p-4">
            <p style={{ fontFamily: 'DM Mono, monospace' }} className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[hsl(225,70%,35%)]">{c.label}</p>
            <p className="font-display text-3xl font-bold mt-2 mb-1">{c.fmt(curr)}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">vs prev</span>
              {deltaPill(curr, prev, { fmt: c.deltaFmt, invert: c.invert })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------- Trend ----------
type TrendMetric = 'visibility' | 'share_of_voice' | 'sentiment' | 'avg_position';
const TREND_METRICS: { key: TrendMetric; label: string }[] = [
  { key: 'visibility', label: 'Visibility' },
  { key: 'share_of_voice', label: 'Share of Voice' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'avg_position', label: 'Avg Position' },
];

const COMPETITOR_PALETTE = [
  'hsl(0 0% 65%)',
  'hsl(0 0% 50%)',
  'hsl(0 0% 38%)',
  'hsl(0 0% 28%)',
  'hsl(35 70% 55%)',
  'hsl(0 60% 60%)',
];

const TrendChart = ({ rows, loading }: { rows: CompetitiveTrendRow[]; loading: boolean }) => {
  const [metric, setMetric] = useState<TrendMetric>('visibility');

  const { brands, data } = useMemo(() => {
    const brandMap = new Map<string, { brand_id: string; brand_name: string; is_client_brand: boolean }>();
    rows.forEach(r => {
      if (!brandMap.has(r.brand_id)) {
        brandMap.set(r.brand_id, {
          brand_id: r.brand_id,
          brand_name: r.brand_name,
          is_client_brand: r.is_client_brand,
        });
      }
    });
    const brandsArr = Array.from(brandMap.values()).sort((a, b) => {
      if (a.is_client_brand !== b.is_client_brand) return a.is_client_brand ? -1 : 1;
      return a.brand_name.localeCompare(b.brand_name);
    });

    const dateMap = new Map<string, Record<string, any>>();
    rows.forEach(r => {
      if (!dateMap.has(r.date)) {
        dateMap.set(r.date, { date: r.date, label: format(parseISO(r.date), 'MMM d') });
      }
      const obj = dateMap.get(r.date)!;
      obj[r.brand_name] = r[metric];
    });
    const dataArr = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return { brands: brandsArr, data: dataArr };
  }, [rows, metric]);

  const isPct = metric === 'visibility' || metric === 'share_of_voice';
  const yFmt = (v: number) =>
    isPct ? `${Math.round(v * 100)}%` : metric === 'avg_position' ? v.toFixed(1) : Math.round(v).toString();

  const brandColor = (b: { is_client_brand: boolean }, idx: number) => {
    if (b.is_client_brand) return 'hsl(var(--chart-navy))';
    const compIdx = brands.filter((x, i) => i < idx && !x.is_client_brand).length;
    return COMPETITOR_PALETTE[compIdx % COMPETITOR_PALETTE.length];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const sorted = [...payload].sort((a: any, b: any) => {
      const aBrand = brands.find(x => x.brand_name === a.dataKey);
      const bBrand = brands.find(x => x.brand_name === b.dataKey);
      if (aBrand?.is_client_brand) return -1;
      if (bBrand?.is_client_brand) return 1;
      return 0;
    });
    return (
      <div style={{ background: 'hsl(var(--chart-navy))', color: 'white', fontSize: 11, padding: '8px 10px', borderRadius: 4 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {sorted.map((p: any) => {
          const b = brands.find(x => x.brand_name === p.dataKey);
          return (
            <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: b?.is_client_brand ? 700 : 400 }}>
              <span style={{ color: p.color }}>● {p.dataKey}</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>{p.value == null ? '—' : yFmt(Number(p.value))}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Competitive Trend Over Time</h3>
        <div className="flex gap-0 border border-border">
          {TREND_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                'px-2.5 py-1 text-[9px] font-semibold tracking-[0.1em] uppercase transition-colors',
                metric === m.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >{m.label}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[260px] w-full" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No trend data for this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--chart-grid))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
              axisLine={false} tickLine={false}
              tickFormatter={yFmt}
              reversed={metric === 'avg_position'}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', paddingTop: 8 }}
              iconSize={8}
              formatter={(value: string) => {
                const b = brands.find(x => x.brand_name === value);
                return (
                  <span style={{ color: 'hsl(0 0% 25%)', fontWeight: b?.is_client_brand ? 700 : 400 }}>{value}</span>
                );
              }}
            />
            {brands.map((b, idx) => (
              <Line
                key={b.brand_id}
                type="monotone"
                dataKey={b.brand_name}
                stroke={brandColor(b, idx)}
                strokeWidth={b.is_client_brand ? 2.5 : 1.5}
                strokeDasharray={b.is_client_brand ? undefined : '4 2'}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ---------- Model x Brand matrix ----------
const ModelBrandMatrix = ({ rows, loading }: { rows: MatrixRow[]; loading: boolean }) => {
  const { platforms, brands, lookup } = useMemo(() => {
    const platformsSet = new Set<string>();
    const brandsMap = new Map<string, { brand_id: string; brand_name: string; is_client_brand: boolean }>();
    const lookup = new Map<string, number | null>();
    rows.forEach(r => {
      platformsSet.add(r.platform);
      if (!brandsMap.has(r.brand_id)) brandsMap.set(r.brand_id, { brand_id: r.brand_id, brand_name: r.brand_name, is_client_brand: r.is_client_brand });
      lookup.set(`${r.brand_id}::${r.platform}`, r.visibility);
    });
    const brandsArr = Array.from(brandsMap.values()).sort((a, b) => {
      if (a.is_client_brand !== b.is_client_brand) return a.is_client_brand ? -1 : 1;
      return a.brand_name.localeCompare(b.brand_name);
    });
    return { platforms: Array.from(platformsSet).sort(), brands: brandsArr, lookup };
  }, [rows]);

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Model × Brand Visibility</h3>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No matrix data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-3 font-semibold uppercase tracking-[0.08em] text-[10px]">Brand</th>
                {platforms.map(p => (
                  <th key={p} className="py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px] text-center">{platformLabel(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.brand_id} className={cn('border-t border-border', b.is_client_brand && 'border-l-4 border-l-[hsl(var(--chart-gold))] bg-[hsl(var(--chart-gold))]/5')}>
                  <td className={cn('py-2 pr-3', b.is_client_brand ? 'font-bold text-foreground' : 'text-foreground/80')}>{b.brand_name}</td>
                  {platforms.map(p => {
                    const v = lookup.get(`${b.brand_id}::${p}`) ?? null;
                    const intensity = v == null ? 0 : Math.min(1, v);
                    const bg = v == null ? 'transparent' : `hsla(225, 70%, 35%, ${0.08 + intensity * 0.85})`;
                    const color = intensity > 0.5 ? 'white' : 'hsl(0 0% 15%)';
                    return (
                      <td key={p} className="p-1 text-center">
                        <div style={{ background: bg, color }} className="py-1.5 px-2 text-[11px] font-medium" title={`${b.brand_name} · ${platformLabel(p)}: ${fmtPct(v)}`}>
                          {v == null ? '—' : fmtPct(v, 0)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------- Competitive Table ----------
type SortKey = keyof Pick<BrandSummaryRow, 'visibility' | 'share_of_voice' | 'avg_position' | 'sentiment' | 'mention_count' | 'brand_name'>;
const CompetitiveTable = ({ rows, loading }: { rows: BrandSummaryRow[]; loading: boolean }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'visibility', dir: 'desc' });

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const av = a[sort.key] as any;
      const bv = b[sort.key] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
    return out;
  }, [rows, sort]);

  const toggleSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'brand_name' ? 'asc' : 'desc' });
  };

  const cols: { key: SortKey; label: string; align?: 'right' | 'left'; render: (r: BrandSummaryRow) => React.ReactNode }[] = [
    { key: 'brand_name', label: 'Brand', align: 'left', render: r => r.brand_name },
    { key: 'visibility', label: 'Visibility', align: 'right', render: r => fmtPct(r.visibility) },
    { key: 'share_of_voice', label: 'SOV', align: 'right', render: r => fmtPct(r.share_of_voice) },
    { key: 'avg_position', label: 'Avg Pos', align: 'right', render: r => fmtPos(r.avg_position) },
    { key: 'sentiment', label: 'Sentiment', align: 'right', render: r => fmtInt(r.sentiment) },
    { key: 'mention_count', label: 'Mentions', align: 'right', render: r => fmtNum(r.mention_count) },
  ];

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Competitive Set</h3>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No competitive data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                {cols.map(c => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      'py-2 px-2 cursor-pointer select-none font-semibold uppercase tracking-[0.08em] text-[10px]',
                      c.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr
                  key={r.brand_id}
                  className={cn('border-b border-border/60', r.is_client_brand && 'bg-[hsl(var(--chart-gold))]/10')}
                >
                  {cols.map(c => (
                    <td
                      key={c.key}
                      className={cn('py-2 px-2', c.align === 'right' ? 'text-right' : 'text-left', r.is_client_brand && 'font-bold')}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------- Per-Platform Competitive SOV ----------
const PerPlatformCompetitiveSov = ({ rows, loading }: { rows: PlatformCompetitiveRow[]; loading: boolean }) => {
  const byPlatform = useMemo(() => {
    const map = new Map<string, PlatformCompetitiveRow[]>();
    rows.forEach(r => {
      const arr = map.get(r.platform) ?? [];
      arr.push(r);
      map.set(r.platform, arr);
    });
    return map;
  }, [rows]);

  const platforms = Array.from(byPlatform.keys()).sort();

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Per-Platform Share of Voice</h3>
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        </div>
      ) : platforms.length === 0 ? (
        <div className="bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground text-center py-6">No per-platform SOV for this period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {platforms.map(p => {
            const top = (byPlatform.get(p) ?? [])
              .filter(r => r.share_of_voice != null)
              .sort((a, b) => (b.share_of_voice ?? 0) - (a.share_of_voice ?? 0))
              .slice(0, 8)
              .map(r => ({
                brand: r.brand_name,
                value: Number(((r.share_of_voice ?? 0) * 100).toFixed(1)),
                isClient: r.is_client_brand,
              }));
            return (
              <div key={p} className="bg-card border border-border p-5">
                <h4 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">{platformLabel(p)}</h4>
                {top.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, top.length * 28)}>
                    <BarChart data={top} layout="vertical" margin={{ left: 100, right: 24 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="brand" tick={{ fontSize: 10, fill: 'hsl(0 0% 30%)' }} axisLine={false} tickLine={false} width={95} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--chart-navy))', border: 'none', borderRadius: 2, color: 'white', fontSize: 11 }} formatter={(v: any) => `${v}%`} />
                      <Bar dataKey="value" barSize={14} radius={[0, 1, 1, 0]}>
                        {top.map((d, i) => (
                          <Cell key={i} fill={d.isClient ? 'hsl(var(--chart-navy))' : 'hsl(0 0% 60%)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------- Gap Analysis: Source Opportunities ----------
const GAP_PAGE = 20;
const SourceOpportunities = ({
  clientId, p_start, p_end,
}: { clientId: string; p_start: string; p_end: string }) => {
  const [mode, setMode] = useState<'domain' | 'url'>('domain');
  const [domainRows, setDomainRows] = useState<GapDomainRow[]>([]);
  const [urlRows, setUrlRows] = useState<GapUrlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    const run = async () => {
      const base = { p_client_id: clientId, p_start, p_end, p_limit: 200 };
      const [d, u] = await Promise.all([
        supabase.rpc('peec_gap_domains', base),
        supabase.rpc('peec_gap_urls', base),
      ]);
      if (cancelled) return;
      setDomainRows((d.data ?? []) as GapDomainRow[]);
      setUrlRows((u.data ?? []) as GapUrlRow[]);
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [clientId, p_start, p_end]);

  useEffect(() => { setPage(1); }, [mode]);

  const sortedDomains = useMemo(
    () => [...domainRows].sort((a, b) => b.citation_count - a.citation_count),
    [domainRows]
  );
  const sortedUrls = useMemo(
    () => [...urlRows].sort((a, b) => b.citation_count - a.citation_count),
    [urlRows]
  );
  const rows = mode === 'domain' ? sortedDomains : sortedUrls;
  const totalPages = Math.max(1, Math.ceil(rows.length / GAP_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * GAP_PAGE, safePage * GAP_PAGE);

  return (
    <div className="bg-card border border-border p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-muted-foreground">
          High-authority sources citing your competitors but not you — prioritize outreach here.
        </p>
        <div className="flex border border-border">
          {(['domain', 'url'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase',
                mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              By {m === 'domain' ? 'Domain' : 'URL'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No gap sources for this period.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Source</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Classification</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Citations</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Competitors Cited Here</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => {
                  const isUrl = mode === 'url';
                  const u = r as GapUrlRow;
                  const d = r as GapDomainRow;
                  const competitors = r.competitor_brands ?? [];
                  return (
                    <tr key={isUrl ? `${u.url}-${i}` : `${d.domain}-${i}`} className="border-b border-border/60 align-top">
                      <td className="py-2 px-2 max-w-[360px]">
                        {isUrl ? (
                          <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline block truncate">
                            {u.title || u.url}
                          </a>
                        ) : (
                          <span className="text-foreground">{d.domain}</span>
                        )}
                        {isUrl && <div className="text-[10px] text-muted-foreground truncate">{u.domain}</div>}
                      </td>
                      <td className="py-2 px-2"><ClassificationTag value={r.classification} /></td>
                      <td className="py-2 px-2 text-right">{fmtNum(r.citation_count)}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1">
                          {competitors.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : competitors.map((b, idx) => (
                            <span key={idx} className="text-[9px] font-medium px-1.5 py-0.5 bg-muted text-muted-foreground border border-border">
                              {b}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

// ---------- Gap Analysis: Competitive Gap (from per-platform SOV) ----------
const CompetitiveGap = ({ rows, clientName }: { rows: PlatformCompetitiveRow[]; clientName: string | null }) => {
  const platforms = useMemo(() => {
    const byPlatform = new Map<string, PlatformCompetitiveRow[]>();
    rows.forEach(r => {
      const arr = byPlatform.get(r.platform) ?? [];
      arr.push(r);
      byPlatform.set(r.platform, arr);
    });
    return Array.from(byPlatform.entries()).map(([platform, list]) => {
      const sorted = [...list].sort((a, b) => (b.share_of_voice ?? 0) - (a.share_of_voice ?? 0));
      const client = sorted.find(r => r.is_client_brand) || null;
      const topComp = sorted.find(r => !r.is_client_brand) || null;
      return { platform, client, topComp };
    });
  }, [rows]);

  if (platforms.length === 0) {
    return (
      <div className="bg-card border border-border p-5">
        <p className="text-sm text-muted-foreground text-center py-6">No competitive data for this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border p-5 space-y-5">
      <h4 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
        {clientName ?? 'Client'} vs Top Competitor — by Platform
      </h4>
      {platforms.map(({ platform, client, topComp }) => {
        const clientPct = (client?.share_of_voice ?? 0) * 100;
        const compPct = (topComp?.share_of_voice ?? 0) * 100;
        const gap = clientPct - compPct;
        const ahead = gap >= 0;
        const maxPct = Math.max(clientPct, compPct, 1);
        return (
          <div key={platform} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{platformLabel(platform)}</span>
              <span className={cn('text-[11px] font-bold', ahead ? 'text-positive' : 'text-destructive')}>
                {ahead ? '+' : ''}{gap.toFixed(1)}pts {ahead ? 'ahead' : 'behind'}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-32 truncate font-medium">{client?.brand_name ?? clientName ?? 'Client'}</span>
                <div className="flex-1 h-5 bg-secondary">
                  <div className="h-full" style={{ width: `${(clientPct / maxPct) * 100}%`, background: 'hsl(var(--chart-navy))' }} />
                </div>
                <span className="text-[11px] font-bold w-14 text-right">{clientPct.toFixed(1)}%</span>
              </div>
              {topComp && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] w-32 truncate text-muted-foreground">{topComp.brand_name}</span>
                  <div className="flex-1 h-5 bg-secondary">
                    <div className="h-full bg-foreground/30" style={{ width: `${(compPct / maxPct) * 100}%` }} />
                  </div>
                  <span className="text-[11px] w-14 text-right text-muted-foreground">{compPct.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const GapAnalysisSection = ({
  clientId, p_start, p_end, competitiveRows, clientName,
}: {
  clientId: string; p_start: string; p_end: string;
  competitiveRows: PlatformCompetitiveRow[]; clientName: string | null;
}) => {
  const [view, setView] = useState('SOURCE OPPORTUNITIES');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Gap Analysis</h3>
        <ViewToggle active={view} onToggle={setView} options={['SOURCE OPPORTUNITIES', 'COMPETITIVE GAP']} />
      </div>
      {view === 'SOURCE OPPORTUNITIES'
        ? <SourceOpportunities clientId={clientId} p_start={p_start} p_end={p_end} />
        : <CompetitiveGap rows={competitiveRows} clientName={clientName} />}
    </div>
  );
};

// ---------- AI Conversation Intelligence ----------
const CHAT_PAGE = 10;
const ConversationIntelligence = ({
  clientId, p_start, p_end, p_platform, clientName,
}: {
  clientId: string; p_start: string; p_end: string; p_platform: string | null; clientName: string | null;
}) => {
  const [mode, setMode] = useState<'recent' | 'mentioned'>('recent');
  const [page, setPage] = useState(1);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatRow | null>(null);

  useEffect(() => { setPage(1); }, [mode, clientId, p_start, p_end, p_platform]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      const { data, error } = await supabase.rpc('peec_chats_page', {
        p_client_id: clientId,
        p_start, p_end,
        p_only_mentioned: mode === 'mentioned',
        p_platform,
        p_limit: CHAT_PAGE,
        p_offset: (page - 1) * CHAT_PAGE,
      });
      if (cancelled) return;
      if (error) {
        console.error('peec_chats_page failed:', error);
        setChats([]); setTotal(0);
      } else {
        const rows = (data ?? []) as ChatRow[];
        setChats(rows);
        setTotal(rows[0]?.total_count ?? 0);
      }
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [clientId, p_start, p_end, p_platform, mode, page]);

  const totalPages = Math.max(1, Math.ceil(total / CHAT_PAGE));
  const mentionedLabel = clientName ? `${clientName.toUpperCase()} MENTIONED` : 'CLIENT MENTIONED';

  return (
    <div className="bg-card border border-border p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI Conversation Intelligence</h3>
        <div className="flex border border-border">
          {(['recent', 'mentioned'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase',
                mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              {m === 'recent' ? 'RECENT CHATS' : mentionedLabel}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : chats.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No conversations for this period.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chats.map(chat => {
              const brands = Array.isArray(chat.brands_mentioned) ? chat.brands_mentioned : [];
              return (
                <button key={chat.chat_id} onClick={() => setSelected(chat)}
                  className="bg-secondary/30 border border-border p-4 text-left hover:bg-secondary/60 transition-colors space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-foreground text-background">
                      {platformLabel(chat.platform)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {chat.date ? format(new Date(chat.date), 'MMM d, yyyy') : ''}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{chat.prompt_text}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-3">{chat.response_text}</p>
                  {chat.client_mentioned && (
                    <span className="inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-[hsl(var(--chart-gold))] text-foreground">
                      Mentioned · Position #{chat.client_position ?? '—'}
                    </span>
                  )}
                  {brands.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {brands.slice(0, 3).map((b, i) => (
                        <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 bg-muted text-muted-foreground border border-border">
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 pt-3 border-t border-border">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border disabled:opacity-30 hover:bg-muted">
              Previous
            </button>
            <span className="text-[11px] text-muted-foreground">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border disabled:opacity-30 hover:bg-muted">
              Next
            </button>
          </div>
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          {selected && (() => {
            const brands = Array.isArray(selected.brands_mentioned) ? selected.brands_mentioned : [];
            const rawSources = Array.isArray(selected.sources) ? selected.sources : [];
            const sources = [...rawSources].sort((a, b) => {
              const av = a.citationPosition ?? Number.MAX_SAFE_INTEGER;
              const bv = b.citationPosition ?? Number.MAX_SAFE_INTEGER;
              return av - bv;
            });
            const rawQueries = Array.isArray(selected.queries) ? selected.queries : [];
            const queries: string[] = rawQueries
              .map((q: any) => (typeof q === 'string' ? q : (q && typeof q.text === 'string' ? q.text : '')))
              .filter((s: string) => s.trim().length > 0);
            return (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-5">
                  <SheetHeader className="p-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-foreground text-background">
                        {platformLabel(selected.platform)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {selected.date ? format(new Date(selected.date), 'MMM d, yyyy') : ''}
                      </span>
                    </div>
                    <SheetTitle className="text-sm font-bold text-foreground leading-snug">{selected.prompt_text}</SheetTitle>
                  </SheetHeader>

                  <div>
                    <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Response</h4>
                    {selected.client_mentioned && (
                      <span className="inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-[hsl(var(--chart-gold))] text-foreground mb-2">
                        Brand Mentioned · Position #{selected.client_position ?? '—'}
                      </span>
                    )}
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selected.response_text}</p>
                  </div>

                  {brands.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Brands Mentioned</h4>
                      <div className="space-y-1.5">
                        {brands.map((b, i) => {
                          const isClient = selected.client_mentioned
                            && b.position != null
                            && b.position === selected.client_position;
                          return (
                            <div key={i} className={cn(
                              'flex items-center justify-between px-3 py-1.5 border',
                              isClient
                                ? 'bg-[hsl(var(--chart-gold))]/15 border-[hsl(var(--chart-gold))]'
                                : 'bg-secondary/30 border-border'
                            )}>
                              <span className={cn('text-xs', isClient ? 'font-bold' : 'font-medium')}>{b.name}</span>
                              {b.position != null && (
                                <span style={{ fontFamily: 'DM Mono, monospace' }} className="text-[10px] text-muted-foreground">
                                  Position #{b.position}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {queries.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Fanout Queries</h4>
                      <div className="space-y-1">
                        {queries.map((q, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                            <Search className="w-3 h-3 mt-0.5 shrink-0 opacity-60" />
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2">Sources</h4>
                      <div className="space-y-1.5">
                        {sources.map((s, i) => {
                          const url = s.url || '';
                          const domain = s.domain || (() => { try { return new URL(url).hostname; } catch { return url; } })();
                          const cc = s.citationCount ?? 0;
                          return (
                            <LinkPreviewTrigger key={i} url={url}
                              meta={[{ label: 'Domain', value: domain }]}
                              className="flex w-full items-center justify-between bg-secondary/30 px-3 py-1.5 border border-border hover:bg-secondary/60 transition-colors text-left">
                              <span className="text-xs font-medium text-foreground truncate">{domain}</span>
                              <span className="flex items-center gap-2 shrink-0 ml-2">
                                {cc > 0 && (
                                  <span style={{ fontFamily: 'DM Mono, monospace' }} className="text-[10px] text-muted-foreground">
                                    {cc} citation{cc === 1 ? '' : 's'}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground">↗</span>
                              </span>
                            </LinkPreviewTrigger>
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

// ---------- Top Domains (paginated) ----------
const DOMAINS_PAGE = 20;
const TopDomainsTable = ({ rows, loading }: { rows: DomainRow[]; loading: boolean }) => {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / DOMAINS_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * DOMAINS_PAGE, safePage * DOMAINS_PAGE);
  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Top Domains</h3>
      {loading ? <Skeleton className="h-48 w-full" /> :
        rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No domain data for this period.</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Domain</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Class</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Citations</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Retrievals</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Citation Rate</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Retrieved %</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.domain} className="border-b border-border/60">
                    <td className="py-2 px-2 text-foreground">{r.domain}</td>
                    <td className="py-2 px-2"><ClassificationTag value={r.classification} /></td>
                    <td className="py-2 px-2 text-right">{fmtNum(r.citation_count)}</td>
                    <td className="py-2 px-2 text-right">{fmtNum(r.retrieval_count)}</td>
                    <td className="py-2 px-2 text-right">{fmtPct(r.citation_rate)}</td>
                    <td className="py-2 px-2 text-right">{fmtPct(r.retrieved_percentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

// ---------- Top URLs (paginated) ----------
const URLS_PAGE = 20;
const TopUrlsTable = ({ rows, loading }: { rows: UrlRow[]; loading: boolean }) => {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / URLS_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * URLS_PAGE, safePage * URLS_PAGE);
  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Top Source URLs</h3>
      {loading ? <Skeleton className="h-48 w-full" /> :
        rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No source URL data for this period.</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Title / URL</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Domain</th>
                  <th className="text-left py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Class</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Citations</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Retrievals</th>
                  <th className="text-right py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px]">Citation Rate</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.url} className="border-b border-border/60">
                    <td className="py-2 px-2 max-w-[400px]">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline block truncate">
                        {r.title || r.url}
                      </a>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{r.domain}</td>
                    <td className="py-2 px-2"><ClassificationTag value={r.classification} /></td>
                    <td className="py-2 px-2 text-right">{fmtNum(r.citation_count)}</td>
                    <td className="py-2 px-2 text-right">{fmtNum(r.retrieval_count)}</td>
                    <td className="py-2 px-2 text-right">{fmtPct(r.citation_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

// ---------- Search Queries (paginated) ----------
const QUERIES_PAGE = 25;
const SearchQueriesTable = ({ rows, loading }: { rows: QueryRow[]; loading: boolean }) => {
  const [page, setPage] = useState(1);
  const [selectedQuery, setSelectedQuery] = useState<QueryRow | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setPage(1); }, [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / QUERIES_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * QUERIES_PAGE, safePage * QUERIES_PAGE);

  const handleCopy = async () => {
    if (!selectedQuery) return;
    try {
      await navigator.clipboard.writeText(selectedQuery.query_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">AI Search Queries</h3>
      {loading ? <Skeleton className="h-48 w-full" /> :
        rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No search query data for this period.</p> : (
        <>
          <div className="divide-y divide-border">
            {paged.map((q, i) => (
              <button
                key={`${q.query_text}-${i}`}
                type="button"
                onClick={() => setSelectedQuery(q)}
                className="w-full flex items-center gap-4 py-2.5 text-left cursor-pointer hover:bg-muted/40 transition-colors px-2 -mx-2"
              >
                <span className="text-[11px] font-bold w-6 text-right text-muted-foreground font-mono">{(safePage - 1) * QUERIES_PAGE + i + 1}</span>
                <span className="text-[13px] flex-1">"{q.query_text}"</span>
                <span className="text-[11px] text-muted-foreground font-mono">{q.freq.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Sheet open={!!selectedQuery} onOpenChange={(o) => { if (!o) { setSelectedQuery(null); setCopied(false); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          {selectedQuery && (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <SheetHeader className="p-0 space-y-2 text-left">
                  <SheetTitle
                    className="text-xl text-foreground leading-snug"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    "{selectedQuery.query_text}"
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selectedQuery.freq.toLocaleString()} times in this period
                  </p>
                </SheetHeader>

                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                    AI Engines That Ran This Query
                  </h4>
                  <p className="text-xs text-muted-foreground italic">
                    Filter by platform above to see per-engine breakdown.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full px-4 py-2.5 text-xs font-bold tracking-wider uppercase bg-[hsl(var(--chart-navy))] text-white hover:opacity-90 transition-opacity"
                  >
                    {copied ? 'Copied!' : 'Copy Query'}
                  </button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ---------- Shopping (paginated) ----------
const PRODUCTS_PAGE = 25;
const ShoppingTable = ({ rows, loading }: { rows: ProductRow[]; loading: boolean }) => {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PRODUCTS_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * PRODUCTS_PAGE, safePage * PRODUCTS_PAGE);
  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Shopping / Products</h3>
      {loading ? <Skeleton className="h-48 w-full" /> :
        rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No shopping data for this period.</p> : (
        <>
          <div className="divide-y divide-border">
            {paged.map((p, i) => (
              <div key={`${p.product}-${i}`} className="flex items-center gap-4 py-2.5">
                <span className="text-[11px] font-bold w-6 text-right text-muted-foreground">{(safePage - 1) * PRODUCTS_PAGE + i + 1}</span>
                <span className="text-[13px] flex-1">{p.product}</span>
                <span className="text-[11px] text-muted-foreground">{p.freq.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

// ---------- AI GEO Recommendations (admin-only) ----------
interface GeoRecommendation {
  title: string;
  action: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  targets: string[];
  platforms: string[];
}
interface GeoSuggestions {
  headline: string;
  summary: string;
  recommendations: GeoRecommendation[];
  watch_items: string[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const PRIORITY_STYLES: Record<GeoRecommendation['priority'], string> = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-corp-news',
  low: 'bg-muted text-muted-foreground',
};

const GeoRecommendationsSection = ({
  clientId, p_start, p_end, periodType,
}: { clientId: string; p_start: string; p_end: string; periodType: PeriodKey }) => {
  const [suggestions, setSuggestions] = useState<GeoSuggestions | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    const run = async () => {
      const { data, error } = await supabase
        .from('peec_geo_suggestions' as any)
        .select('suggestions, model_used, generated_at')
        .eq('client_id', clientId)
        .eq('period_type', periodType)
        .eq('period_start', p_start)
        .eq('period_end', p_end)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('peec_geo_suggestions cache read failed:', error);
        setSuggestions(null);
        setGeneratedAt(null);
        setModelUsed(null);
      } else if (data) {
        const d = data as any;
        setSuggestions((d.suggestions ?? null) as GeoSuggestions | null);
        setGeneratedAt(d.generated_at ?? null);
        setModelUsed(d.model_used ?? null);
      } else {
        setSuggestions(null);
        setGeneratedAt(null);
        setModelUsed(null);
      }
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [clientId, p_start, p_end, periodType]);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke('peec-geo-suggestions', {
      body: { client_id: clientId, p_start, p_end, period_type: periodType, force: true },
    });
    setGenerating(false);
    if (error || (data && (data as any).error)) {
      setErrorMsg((data as any)?.error || error?.message || 'Failed to generate recommendations.');
      return;
    }
    const d = data as any;
    if (d?.suggestions) {
      setSuggestions(d.suggestions as GeoSuggestions);
      setGeneratedAt(d.generated_at ?? new Date().toISOString());
      setModelUsed(d.model_used ?? modelUsed);
    }
  };

  const hasData = !!suggestions;

  return (
    <div className="bg-card border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI GEO Recommendations</h3>
          <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-[hsl(var(--chart-gold))] text-foreground">✦ Beta</span>
          {generatedAt && (
            <span className="text-[10px] text-muted-foreground">
              Generated {timeAgo(generatedAt)}{modelUsed ? ` · ${modelUsed}` : ''}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || loading}
          className={cn(
            'px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors',
            'border border-[hsl(225,70%,35%)] text-[hsl(225,70%,35%)] hover:bg-[hsl(225,70%,35%)] hover:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {generating ? 'Analyzing…' : hasData ? 'Regenerate' : 'Generate Recommendations'}
        </button>
      </div>

      {generating ? (
        <div className="flex items-center gap-3 py-10 justify-center">
          <span className="inline-block w-3 h-3 border-2 border-[hsl(225,70%,35%)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Analyzing AI search data…</span>
        </div>
      ) : loading ? (
        <Skeleton className="h-32 w-full" />
      ) : errorMsg ? (
        <p className="text-sm text-destructive text-center py-4">{errorMsg}</p>
      ) : !hasData ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">No recommendations generated yet for this period.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="font-display text-2xl font-bold text-foreground leading-snug">{suggestions!.headline}</h4>
            {suggestions!.summary && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{suggestions!.summary}</p>
            )}
          </div>

          {suggestions!.recommendations?.length > 0 && (
            <div className="space-y-3">
              {suggestions!.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 border border-border p-4 bg-background">
                  <div className="shrink-0">
                    <span className={cn(
                      'inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5',
                      PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low
                    )}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <p className="text-sm font-bold text-foreground">{rec.title}</p>
                    {rec.action && <p className="text-[13px] text-foreground/90">{rec.action}</p>}
                    {rec.rationale && <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.rationale}</p>}
                    {(rec.targets?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rec.targets.map((t, j) => {
                          const isUrl = /^https?:\/\//i.test(t);
                          let label = t;
                          if (isUrl) {
                            try { label = new URL(t).hostname; } catch { /* keep raw */ }
                          }
                          const cls = 'text-[9px] font-medium px-1.5 py-0.5 bg-muted text-muted-foreground border border-border';
                          return isUrl ? (
                            <a key={j} href={t} target="_blank" rel="noopener noreferrer" className={cn(cls, 'hover:bg-muted-foreground/10')}>
                              {label}
                            </a>
                          ) : (
                            <span key={j} className={cls}>{label}</span>
                          );
                        })}
                      </div>
                    )}
                    {(rec.platforms?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rec.platforms.map((p, j) => (
                          <span key={j} className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-foreground text-background">
                            {platformLabel(p)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {suggestions!.watch_items?.length > 0 && (
            <div className="pt-2 border-t border-border">
              <h5 className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-2">Watch</h5>
              <ul className="list-disc pl-5 space-y-1">
                {suggestions!.watch_items.map((w, i) => (
                  <li key={i} className="text-[12px] text-muted-foreground leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Main ----------
const AIVisibilityTab = () => {
  const { activeClientId, refreshKey } = useWeek();
  const { clientName, isAdmin } = useAdmin();
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const [platform, setPlatform] = useState<Platform>('all');

  const { p_start, p_end } = useMemo(() => periodToRange(period, custom), [period, custom]);
  const p_platform = platform === 'all' ? null : platform;

  // State
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [trend, setTrend] = useState<CompetitiveTrendRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [summary, setSummary] = useState<BrandSummaryRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [urls, setUrls] = useState<UrlRow[]>([]);
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [platformScores, setPlatformScores] = useState<PlatformScoreRow[]>([]);
  const [platformCompetitive, setPlatformCompetitive] = useState<PlatformCompetitiveRow[]>([]);

  const [loading, setLoading] = useState({
    kpis: true, trend: true, matrix: true, summary: true,
    domains: true, urls: true, queries: true, products: true,
    platformScores: true, platformCompetitive: true,
  });

  useEffect(() => {
    if (!activeClientId) return;
    let cancelled = false;
    const set = <K extends keyof typeof loading>(k: K, v: boolean) =>
      setLoading(prev => ({ ...prev, [k]: v }));

    const baseArgs = { p_client_id: activeClientId, p_start, p_end };
    const withPlatform = { ...baseArgs, p_platform };

    const run = async <T,>(
      fn: keyof typeof loading,
      rpc: string,
      args: Record<string, any>,
      apply: (data: T[]) => void,
    ) => {
      set(fn, true);
      const { data, error } = await supabase.rpc(rpc, args);
      if (cancelled) return;
      if (error) {
        console.error(`RPC ${rpc} failed:`, error);
        apply([] as T[]);
      } else {
        apply((data ?? []) as T[]);
      }
      set(fn, false);
    };

    run<PlatformScoreRow>('platformScores', 'peec_platform_scores', baseArgs, setPlatformScores);
    run<KpiRow>('kpis', 'peec_client_kpis', withPlatform, setKpis);
    run<CompetitiveTrendRow>('trend', 'peec_competitive_trend', withPlatform, setTrend);
    run<MatrixRow>('matrix', 'peec_model_matrix', baseArgs, setMatrix);
    run<BrandSummaryRow>('summary', 'peec_brand_summary', withPlatform, setSummary);
    run<PlatformCompetitiveRow>('platformCompetitive', 'peec_platform_competitive', baseArgs, setPlatformCompetitive);
    run<DomainRow>('domains', 'peec_top_domains', { ...baseArgs, p_limit: 200 }, setDomains);
    run<UrlRow>('urls', 'peec_top_urls', { ...baseArgs, p_limit: 200 }, setUrls);
    run<QueryRow>('queries', 'peec_top_search_queries', { ...baseArgs, p_limit: 300 }, setQueries);
    run<ProductRow>('products', 'peec_shopping_products', { ...baseArgs, p_limit: 200 }, setProducts);

    return () => { cancelled = true; };
  }, [activeClientId, p_start, p_end, p_platform, refreshKey]);

  if (!activeClientId) {
    return <div className="p-6 text-sm text-muted-foreground">Select a client to view AI visibility.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PeriodControls
        period={period} setPeriod={setPeriod}
        custom={custom} setCustom={setCustom}
        platform={platform} setPlatform={setPlatform}
      />
      <PlatformScoreCards rows={platformScores} loading={loading.platformScores} />
      <KpiCards rows={kpis} loading={loading.kpis} />
      {isAdmin && (
        <GeoRecommendationsSection
          clientId={activeClientId}
          p_start={p_start}
          p_end={p_end}
          periodType={period}
        />
      )}
      <TrendChart rows={trend} loading={loading.trend} />
      <ModelBrandMatrix rows={matrix} loading={loading.matrix} />
      <CompetitiveTable rows={summary} loading={loading.summary} />
      <PerPlatformCompetitiveSov rows={platformCompetitive} loading={loading.platformCompetitive} />
      <GapAnalysisSection
        clientId={activeClientId}
        p_start={p_start}
        p_end={p_end}
        competitiveRows={platformCompetitive}
        clientName={clientName}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopDomainsTable rows={domains} loading={loading.domains} />
        <TopUrlsTable rows={urls} loading={loading.urls} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SearchQueriesTable rows={queries} loading={loading.queries} />
        <ShoppingTable rows={products} loading={loading.products} />
      </div>
      <ConversationIntelligence
        clientId={activeClientId}
        p_start={p_start}
        p_end={p_end}
        p_platform={p_platform}
        clientName={clientName}
      />
    </div>
  );
};

export default AIVisibilityTab;
