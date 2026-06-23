import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ---------- Types ----------
type PeriodKey = 'day' | 'week' | 'month' | 'custom';
type Platform =
  | 'all' | 'chatgpt' | 'perplexity' | 'google_ai' | 'google_ai_mode'
  | 'gemini' | 'claude' | 'copilot';

interface KpiRow {
  metric: 'visibility' | 'sentiment' | 'position' | 'share_of_voice';
  current_value: number | null;
  previous_value: number | null;
}
interface TrendRow {
  date: string;
  visibility: number | null;
  sentiment: number | null;
  avg_position: number | null;
  share_of_voice: number | null;
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

// ---------- Helpers ----------
const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'all', label: 'All Platforms' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'google_ai', label: 'Google AI' },
  { value: 'google_ai_mode', label: 'Google AI Mode' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'copilot', label: 'Copilot' },
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
  invert?: boolean; // lower is better
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

const TrendChart = ({ rows, loading }: { rows: TrendRow[]; loading: boolean }) => {
  const [metric, setMetric] = useState<TrendMetric>('visibility');
  const data = useMemo(() => rows.map(r => ({
    date: r.date,
    label: format(new Date(r.date), 'MMM d'),
    value: r[metric],
  })), [rows, metric]);

  const isPct = metric === 'visibility' || metric === 'share_of_voice';
  const yFmt = (v: number) => isPct ? `${Math.round(v * 100)}%` : metric === 'avg_position' ? v.toFixed(1) : Math.round(v).toString();

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Trend Over Time</h3>
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
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--chart-grid))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
              axisLine={false} tickLine={false}
              tickFormatter={yFmt}
              reversed={metric === 'avg_position'}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--chart-navy))', border: 'none', borderRadius: 4, color: 'white', fontSize: 11 }}
              formatter={(v: any) => yFmt(Number(v))}
            />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-navy))" strokeWidth={2.25} dot={false} />
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
                  <th key={p} className="py-2 px-2 font-semibold uppercase tracking-[0.08em] text-[10px] text-center">{p}</th>
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
                        <div style={{ background: bg, color }} className="py-1.5 px-2 text-[11px] font-medium" title={`${b.brand_name} · ${p}: ${fmtPct(v)}`}>
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

// ---------- Top Domains ----------
const TopDomainsTable = ({ rows, loading }: { rows: DomainRow[]; loading: boolean }) => (
  <div className="bg-card border border-border p-5">
    <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Top Domains</h3>
    {loading ? <Skeleton className="h-48 w-full" /> :
      rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No domain data for this period.</p> : (
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
            {rows.map(r => (
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
    )}
  </div>
);

// ---------- Top URLs ----------
const TopUrlsTable = ({ rows, loading }: { rows: UrlRow[]; loading: boolean }) => (
  <div className="bg-card border border-border p-5">
    <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Top Source URLs</h3>
    {loading ? <Skeleton className="h-48 w-full" /> :
      rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No source URL data for this period.</p> : (
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
            {rows.map(r => (
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
    )}
  </div>
);

// ---------- Search Queries ----------
const SearchQueriesTable = ({ rows, loading }: { rows: QueryRow[]; loading: boolean }) => (
  <div className="bg-card border border-border p-5">
    <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">AI Search Queries</h3>
    {loading ? <Skeleton className="h-48 w-full" /> :
      rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No search query data for this period.</p> : (
      <div className="divide-y divide-border">
        {rows.map((q, i) => (
          <div key={`${q.query_text}-${i}`} className="flex items-center gap-4 py-2.5">
            <span className="text-[11px] font-bold w-6 text-right text-muted-foreground">{i + 1}</span>
            <span className="text-[13px] flex-1">"{q.query_text}"</span>
            <span className="text-[11px] text-muted-foreground">{q.freq.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ---------- Shopping ----------
const ShoppingTable = ({ rows, loading }: { rows: ProductRow[]; loading: boolean }) => (
  <div className="bg-card border border-border p-5">
    <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Shopping / Products</h3>
    {loading ? <Skeleton className="h-48 w-full" /> :
      rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No shopping data for this period.</p> : (
      <div className="divide-y divide-border">
        {rows.map((p, i) => (
          <div key={`${p.product}-${i}`} className="flex items-center gap-4 py-2.5">
            <span className="text-[11px] font-bold w-6 text-right text-muted-foreground">{i + 1}</span>
            <span className="text-[13px] flex-1">{p.product}</span>
            <span className="text-[11px] text-muted-foreground">{p.freq.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ---------- Main ----------
const AIVisibilityTab = () => {
  const { activeClientId, refreshKey } = useWeek();
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const [platform, setPlatform] = useState<Platform>('all');

  const { p_start, p_end } = useMemo(() => periodToRange(period, custom), [period, custom]);
  const p_platform = platform === 'all' ? null : platform;

  // State
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [summary, setSummary] = useState<BrandSummaryRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [urls, setUrls] = useState<UrlRow[]>([]);
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [loading, setLoading] = useState({
    kpis: true, trend: true, matrix: true, summary: true,
    domains: true, urls: true, queries: true, products: true,
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

    run<KpiRow>('kpis', 'peec_client_kpis', withPlatform, setKpis);
    run<TrendRow>('trend', 'peec_trend', withPlatform, setTrend);
    run<MatrixRow>('matrix', 'peec_model_matrix', baseArgs, setMatrix);
    run<BrandSummaryRow>('summary', 'peec_brand_summary', withPlatform, setSummary);
    run<DomainRow>('domains', 'peec_top_domains', { ...baseArgs, p_limit: 20 }, setDomains);
    run<UrlRow>('urls', 'peec_top_urls', { ...baseArgs, p_limit: 20 }, setUrls);
    run<QueryRow>('queries', 'peec_top_search_queries', { ...baseArgs, p_limit: 50 }, setQueries);
    run<ProductRow>('products', 'peec_shopping_products', { ...baseArgs, p_limit: 50 }, setProducts);

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
      <KpiCards rows={kpis} loading={loading.kpis} />
      <TrendChart rows={trend} loading={loading.trend} />
      <ModelBrandMatrix rows={matrix} loading={loading.matrix} />
      <CompetitiveTable rows={summary} loading={loading.summary} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopDomainsTable rows={domains} loading={loading.domains} />
        <TopUrlsTable rows={urls} loading={loading.urls} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SearchQueriesTable rows={queries} loading={loading.queries} />
        <ShoppingTable rows={products} loading={loading.products} />
      </div>
    </div>
  );
};

export default AIVisibilityTab;
