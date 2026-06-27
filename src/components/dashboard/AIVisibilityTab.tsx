import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';
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

// Engine pill colors (Peec-style) — used in chat list pills + detail header
const PLATFORM_PILL: Record<string, string> = {
  chatgpt: 'bg-[#10a37f] text-white',
  perplexity: 'bg-[#20808d] text-white',
  gemini: 'bg-[#1a73e8] text-white',
  claude: 'bg-[#c96442] text-white',
  google_ai: 'bg-[#4f46e5] text-white',
  google_ai_mode: 'bg-[#6366f1] text-white',
  copilot: 'bg-[#0ea5e9] text-white',
  grok: 'bg-slate-800 text-white',
  rufus: 'bg-[#d97706] text-white',
};
const platformPillCls = (p: string) => PLATFORM_PILL[p] || 'bg-slate-700 text-white';

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
const scoreBadge = (score: number): { label: string; cls: string } => {
  if (score >= 40) return { label: 'STRONG', cls: 'bg-foreground text-background' };
  if (score >= 20) return { label: 'MODERATE', cls: 'bg-corp-news' };
  return { label: 'NEEDS WORK', cls: 'border border-destructive text-destructive' };
};

const PlatformScoreCards = ({
  rows, loading, clientId, pStart, pEnd, clientName, onApplyPlatformFilter,
}: {
  rows: PlatformScoreRow[];
  loading: boolean;
  clientId: string;
  pStart: string | null;
  pEnd: string | null;
  clientName?: string | null;
  onApplyPlatformFilter?: (p: string) => void;
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }
  const byPlatform = new Map(rows.map(r => [r.platform, r]));
  const tileBase = 'text-left bg-card border border-border p-3 cursor-pointer hover:border-foreground/30 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20';
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {ALL_KNOWN_PLATFORMS.map(key => {
          const r = byPlatform.get(key);
          if (!r) {
            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedPlatform(key)}
                className={cn(tileBase, 'opacity-50')}
              >
                <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{platformLabel(key)}</p>
                <p className="text-xs text-muted-foreground mt-6">No data</p>
              </button>
            );
          }
          const score = Math.round((r.visibility ?? 0) * 100);
          const badge = scoreBadge(score);
          return (
            <button
              type="button"
              key={key}
              onClick={() => setSelectedPlatform(key)}
              className={tileBase}
            >
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase">{platformLabel(key)}</p>
              <p style={{ fontFamily: 'DM Mono, monospace' }} className="text-3xl font-bold mt-2 mb-1 text-foreground">{score}</p>
              <span className={cn('inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-1.5', badge.cls)}>
                {badge.label}
              </span>
              <p className="text-[9px] text-muted-foreground leading-tight">
                SoV {fmtPct(r.share_of_voice)} · Sent {fmtInt(r.sentiment)} · Pos {fmtPos(r.avg_position)}
              </p>
            </button>
          );
        })}
      </div>
      <PlatformDetailSheet
        platform={selectedPlatform}
        onClose={() => setSelectedPlatform(null)}
        row={selectedPlatform ? byPlatform.get(selectedPlatform) ?? null : null}
        clientId={clientId}
        pStart={pStart}
        pEnd={pEnd}
        clientName={clientName}
        onApplyPlatformFilter={onApplyPlatformFilter}
      />
    </>
  );
};

const PlatformDetailSheet = ({
  platform, onClose, row, clientId, pStart, pEnd, clientName, onApplyPlatformFilter,
}: {
  platform: string | null;
  onClose: () => void;
  row: PlatformScoreRow | null;
  clientId: string;
  pStart: string | null;
  pEnd: string | null;
  clientName?: string | null;
  onApplyPlatformFilter?: (p: string) => void;
}) => {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!platform || !clientId) return;
    let cancelled = false;
    setExpanded(null);
    setChats([]);
    setLoadingChats(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('peec_chats_page', {
          p_client_id: clientId,
          p_start: pStart,
          p_end: pEnd,
          p_only_mentioned: true,
          p_platform: platform,
          p_limit: 15,
          p_offset: 0,
        });
        if (cancelled) return;
        if (error) {
          console.error('peec_chats_page (platform sheet) failed:', error);
          setChats([]);
        } else {
          setChats((data ?? []) as ChatRow[]);
        }
      } catch (err) {
        console.error('platform sheet chats fetch error:', err);
        if (!cancelled) setChats([]);
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [platform, clientId, pStart, pEnd]);

  const open = platform !== null;
  const score = row ? Math.round((row.visibility ?? 0) * 100) : null;
  const badge = score != null ? scoreBadge(score) : null;
  const mentionedLabel = clientName ? `${clientName.toUpperCase()} MENTIONS` : 'CLIENT MENTIONS';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {platform && (
          <div className="space-y-6 pt-2">
            <div>
              <p className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-muted-foreground mb-1">
                AI Platform
              </p>
              <SheetTitle className="font-display text-2xl font-bold tracking-tight">
                {platformLabel(platform)}
              </SheetTitle>
            </div>

            {!row ? (
              <div className="bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground">No visibility data for this platform yet.</p>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border p-4 flex items-center gap-4">
                  <p style={{ fontFamily: 'DM Mono, monospace' }} className="text-5xl font-bold text-foreground tabular-nums">
                    {score}
                  </p>
                  {badge && (
                    <span className={cn('inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1', badge.cls)}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Share of Voice', value: fmtPct(row.share_of_voice) },
                    { label: 'Sentiment', value: fmtInt(row.sentiment) },
                    { label: 'Avg Position', value: fmtPos(row.avg_position) },
                  ].map((m) => (
                    <div key={m.label} className="bg-card border border-border p-3">
                      <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                        {m.label}
                      </p>
                      <p style={{ fontFamily: 'DM Mono, monospace' }} className="text-lg font-bold text-foreground tabular-nums">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <section>
              <h3 className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                {mentionedLabel} on {platformLabel(platform)}
              </h3>
              <div className="bg-card border border-border divide-y divide-border">
                {loadingChats ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-muted/40 animate-pulse" />
                  ))
                ) : chats.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">
                    No mentions on this platform in this period.
                  </p>
                ) : (
                  chats.map((c) => {
                    const isOpen = expanded === c.chat_id;
                    return (
                      <div key={c.chat_id}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : c.chat_id)}
                          className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          <p className="flex-1 text-sm text-foreground line-clamp-2">{c.prompt_text}</p>
                          <span className="font-mono-ui text-[10px] tracking-[0.1em] uppercase text-muted-foreground shrink-0 mt-0.5">
                            Pos {c.client_position ?? '—'}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 -mt-1">
                            <div className="bg-muted/30 border border-border p-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                              {c.response_text || '— no response text —'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {onApplyPlatformFilter && (
              <button
                onClick={() => { onApplyPlatformFilter(platform); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-border text-[11px] font-mono-ui tracking-[0.18em] uppercase font-medium hover:bg-muted/40 transition-colors"
              >
                View all {platformLabel(platform)} chats →
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ---------- KPI Cards ----------
const KpiCards = ({ rows, loading }: { rows: KpiRow[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map(c => {
        const r = byMetric.get(c.key);
        const curr = r?.current_value ?? null;
        const prev = r?.previous_value ?? null;
        return (
          <div
            key={c.key}
            className="group bg-white border border-slate-200 rounded-xl px-5 py-5 transition-all hover:shadow-md hover:border-slate-300"
          >
            <p
              style={{ fontFamily: 'DM Mono, monospace' }}
              className="text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-500"
            >
              {c.label}
            </p>
            <p
              style={{ fontFamily: 'DM Mono, monospace' }}
              className="text-3xl font-bold mt-3 mb-2 text-slate-900 tabular-nums"
            >
              {c.fmt(curr)}
            </p>
            <div className="flex items-center gap-2">
              {deltaPill(curr, prev, { fmt: c.deltaFmt, invert: c.invert })}
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">vs prev</span>
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

  // Group current page's chats by prompt_text so each row shows all engines that ran the query.
  const grouped = useMemo(() => {
    const map = new Map<string, ChatRow[]>();
    for (const c of chats) {
      const key = c.prompt_text || c.chat_id;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.values());
  }, [chats]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-base font-semibold text-slate-900" style={{ fontFamily: 'Playfair Display, serif' }}>
            AI Conversation Intelligence
          </h3>
          <span className="text-xs text-slate-500 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>
            {total} {total === 1 ? 'result' : 'results'}
          </span>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(['recent', 'mentioned'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase rounded-md transition-colors',
                mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}>
              {m === 'recent' ? 'RECENT' : mentionedLabel}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-10">No conversations for this period.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {grouped.map(group => {
              const first = group[0];
              const platforms = Array.from(new Set(group.map(c => c.platform)));
              const mentionedItem = group.find(c => c.client_mentioned);
              const isMentioned = !!mentionedItem;
              const position = mentionedItem?.client_position;
              return (
                <button
                  key={first.chat_id}
                  onClick={() => setSelected(mentionedItem ?? first)}
                  className="group w-full text-left bg-white border border-slate-200 rounded-lg px-4 py-3.5 hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm transition-all flex items-center gap-4"
                >
                  {/* LEFT: prompt + pills */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {first.prompt_text}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map(p => (
                        <span
                          key={p}
                          className={cn(
                            'inline-flex items-center text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full',
                            platformPillCls(p)
                          )}
                        >
                          {platformLabel(p)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT: mentioned + count */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isMentioned ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {position != null ? `#${position}` : 'Mentioned'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                        Not mentioned
                      </span>
                    )}
                    <span
                      className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md tabular-nums"
                      style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                      ×{group.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-200">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50 transition-colors">
              Previous
            </button>
            <span className="text-[11px] text-slate-500 tabular-nums" style={{ fontFamily: 'DM Mono, monospace' }}>
              Page {page} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50 transition-colors">
              Next
            </button>
          </div>
        </>
      )}

      <ChatDetailModal
        selected={selected}
        chats={chats}
        onClose={() => setSelected(null)}
        onSelect={(c) => setSelected(c)}
      />
    </div>
  );
};

// ---------- Peec-style Chat Detail Modal ----------
const sentimentDotClass = (s?: number | null) => {
  if (s == null) return 'bg-muted-foreground/40';
  if (s > 0.05) return 'bg-emerald-500';
  if (s < -0.05) return 'bg-red-500';
  return 'bg-muted-foreground/50';
};

const highlightClientName = (text: string, clientName?: string) => {
  if (!clientName || !text) return text;
  const parts = text.split(new RegExp(`(${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === clientName.toLowerCase()
      ? <mark key={i} className="bg-[hsl(var(--chart-gold))]/30 text-foreground font-semibold px-0.5 rounded-sm">{p}</mark>
      : <span key={i}>{p}</span>
  );
};

interface ChatDetailModalProps {
  selected: ChatRow | null;
  chats: ChatRow[];
  onClose: () => void;
  onSelect: (c: ChatRow) => void;
}

const ChatDetailModal = ({ selected, chats, onClose, onSelect }: ChatDetailModalProps) => {
  const siblings = useMemo(() => {
    if (!selected) return [];
    return chats.filter(c => c.prompt_text === selected.prompt_text);
  }, [selected, chats]);
  const currentIdx = selected ? siblings.findIndex(c => c.chat_id === selected.chat_id) : -1;
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  return (
    <Sheet open={!!selected} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-[1200px] p-0 bg-white"
      >
        {selected && (() => {
          const brands = Array.isArray(selected.brands_mentioned) ? selected.brands_mentioned : [];
          const rawSources = Array.isArray(selected.sources) ? selected.sources : [];
          const sources = [...rawSources].sort((a, b) => {
            const av = a.citationPosition ?? Number.MAX_SAFE_INTEGER;
            const bv = b.citationPosition ?? Number.MAX_SAFE_INTEGER;
            return av - bv;
          });
          const clientBrand = selected.client_mentioned
            ? brands.find(b => b.position != null && b.position === selected.client_position)?.name
            : undefined;

          return (
            <div className="flex h-full w-full">
              {/* LEFT — Main chat */}
              <div className="flex-1 flex flex-col border-r border-border min-w-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 shrink-0 bg-white">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full',
                      platformPillCls(selected.platform)
                    )}
                  >
                    {platformLabel(selected.platform)}
                    <span className="opacity-90">🇺🇸 US</span>
                  </span>
                  <span
                    className="text-xs text-slate-500 ml-auto tabular-nums"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {selected.date ? format(parseISO(selected.date), 'MMM d, yyyy') : ''}
                  </span>
                </div>

                {/* Scrollable conversation */}
                <ScrollArea className="flex-1 bg-slate-50/40">
                  <div className="px-6 md:px-10 py-8 max-w-3xl mx-auto space-y-6">
                    {/* User prompt bubble */}
                    <div className="flex justify-end">
                      <div className="bg-[hsl(225,70%,35%)] text-white px-5 py-3 rounded-2xl rounded-tr-md max-w-[85%] text-sm leading-relaxed shadow-sm">
                        {selected.prompt_text}
                      </div>
                    </div>

                    <div className="border-t border-slate-200" />


                    {/* AI response */}
                    <div className="bg-white">
                      <div
                        className="prose prose-sm max-w-none text-foreground
                          prose-headings:font-bold prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-2
                          prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                          prose-p:leading-relaxed prose-p:my-2
                          prose-li:my-0.5
                          prose-strong:text-foreground prose-strong:font-semibold
                          prose-a:text-[hsl(225,70%,35%)] prose-a:no-underline hover:prose-a:underline"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p>{typeof children === 'string' ? highlightClientName(children, clientBrand) : children}</p>,
                            li: ({ children }) => <li>{typeof children === 'string' ? highlightClientName(children, clientBrand) : children}</li>,
                          }}
                        >
                          {selected.response_text || ''}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Prev/Next */}
                {siblings.length > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0 bg-secondary/20">
                    <button
                      onClick={() => prev && onSelect(prev)}
                      disabled={!prev}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="w-3 h-3" /> Previous
                    </button>
                    <span className="text-[11px] text-muted-foreground" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {currentIdx + 1} / {siblings.length}
                    </span>
                    <button
                      onClick={() => next && onSelect(next)}
                      disabled={!next}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-[0.05em] uppercase border border-border hover:bg-muted disabled:opacity-30"
                    >
                      Next <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT — Details sidebar */}
              <div className="w-full sm:w-[340px] shrink-0 bg-secondary/10 flex flex-col">
                <div className="px-5 py-4 border-b border-border shrink-0">
                  <h3
                    className="text-base font-bold text-foreground"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    Details
                  </h3>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-5 space-y-6">
                    {/* Brands */}
                    <div>
                      <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2.5">
                        Brands
                      </h4>
                      {brands.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No brands detected.</p>
                      ) : (
                        <div className="space-y-1">
                          {brands.map((b, i) => {
                            const isClient = clientBrand && b.name === clientBrand;
                            return (
                              <div
                                key={i}
                                className={cn(
                                  'flex items-center justify-between gap-2 px-3 py-2 border rounded-lg transition-colors',
                                  isClient
                                    ? 'bg-[hsl(var(--chart-gold))]/15 border-[hsl(var(--chart-gold))]'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn('w-2 h-2 rounded-full shrink-0', sentimentDotClass(b.sentiment))} />
                                  <span className={cn('text-xs truncate', isClient ? 'font-bold text-slate-900' : 'font-medium text-slate-700')}>
                                    {b.name}
                                  </span>
                                </div>
                                {b.position != null && (
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0 tabular-nums"
                                    style={{ fontFamily: 'DM Mono, monospace' }}
                                  >
                                    #{b.position}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Sources */}
                    {sources.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-2.5">
                          Sources
                        </h4>
                        <div className="space-y-1">
                          {sources.map((s, i) => {
                            const url = s.url || '';
                            const domain = s.domain || (() => { try { return new URL(url).hostname; } catch { return url; } })();
                            const cc = s.citationCount ?? 0;
                            return (
                              <LinkPreviewTrigger
                                key={i}
                                url={url}
                                meta={[{ label: 'Domain', value: domain }]}
                                className="flex w-full items-center justify-between gap-2 bg-white px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
                              >
                                <span className="text-xs font-medium text-slate-700 truncate">{domain}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                  {cc > 0 && (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums"
                                      style={{ fontFamily: 'DM Mono, monospace' }}
                                    >
                                      {cc}
                                    </span>
                                  )}
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </span>
                              </LinkPreviewTrigger>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          );
        })()}
      </SheetContent>
    </Sheet>
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
const QUERIES_PAGE = 15;
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
const PRODUCTS_PAGE = 15;
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

// ---------- How AI Describes You (brand attribute grid) ----------
interface BrandAttrCompetitor { global_brand_id: string; name: string; domain?: string | null; mentions?: number | null }
interface BrandAttrValue { value: string; mentions: number; mentions_delta?: number | null; competitor_mentions?: number[] | null }
interface BrandAttrGroup { dimension_id: string; name: string; total_mentions: number; value_count: number; values: BrandAttrValue[] }
interface BrandAttrRow {
  captured_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  competitors: BrandAttrCompetitor[];
  groups: BrandAttrGroup[];
  total_groups: number;
}

const fmtDateSafe = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : format(d, 'MMM d, yyyy');
};

const BrandAttributesSection = ({ clientId, accent, clientName }: { clientId: string | null; accent: string; clientName: string }) => {
  const [row, setRow] = useState<BrandAttrRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('peec_brand_attributes_latest', { p_client_id: clientId });
        if (error) throw error;
        const r: BrandAttrRow | null = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
        if (!cancelled) setRow(r);
      } catch (e) {
        console.error('[BrandAttributes] load failed', e);
        if (!cancelled) setRow(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const windowLabel = useMemo(() => {
    if (!row) return '';
    const a = fmtDateSafe(row.window_start);
    const b = fmtDateSafe(row.window_end);
    if (a && b) return `${a} – ${b}`;
    return a || b || '';
  }, [row]);

  const isEmpty = !row || !row.groups || row.groups.length === 0 || row.total_groups === 0;

  const [expanded, setExpanded] = useState(false);
  const [selectedAttr, setSelectedAttr] = useState<{ group: BrandAttrGroup; value: BrandAttrValue } | null>(null);

  // Hide the section entirely when there's no data — no header, no card, no empty state.
  if (!loading && isEmpty) return null;

  const groups = row?.groups ?? [];
  const visibleGroups = expanded ? groups : groups.slice(0, 4);
  const hasMore = groups.length > 4;

  return (
    <section className="border border-border bg-card">
      <header className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-muted-foreground mb-1">
            How AI Describes You
          </p>
          <h2 className="text-lg font-medium tracking-tight">
            Attributes AI associates with your brand vs competitors
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1.5">
            Tap any attribute to see how AI describes it and how you compare.
          </p>
        </div>
        {windowLabel && (
          <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground pt-1">
            {windowLabel}
          </p>
        )}
      </header>

      <div className="px-6 pb-6">
        {loading ? (
          <div className="space-y-4">
            {[0,1,2].map(i => (
              <div key={i} className="flex gap-4 items-start py-3 border-t border-border/60">
                <Skeleton className="h-4 w-40" />
                <div className="flex gap-2 flex-wrap flex-1">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-7 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/60">
              {visibleGroups.map(group => (
                <div key={group.dimension_id} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 md:gap-6 py-5">
                  <div>
                    <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                      {group.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {group.total_mentions} mention{group.total_mentions === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((v, idx) => {
                      const overlaps = (v.competitor_mentions ?? [])
                        .map((c, i) => ({ c, name: row!.competitors[i]?.name }))
                        .filter(x => x.c > 0 && x.name);
                      const overlapNames = overlaps.slice(0, 3).map(x => x.name);
                      const overflow = overlaps.length - overlapNames.length;
                      const delta = v.mentions_delta ?? 0;
                      return (
                        <div key={`${group.dimension_id}-${idx}`} className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedAttr({ group, value: v })}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-all hover:brightness-95 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            style={{ backgroundColor: `${accent}12`, color: accent, border: `1px solid ${accent}33` }}
                          >
                            <span>{v.value}</span>
                            <span
                              className="font-mono-ui text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: `${accent}22` }}
                            >
                              {v.mentions}
                            </span>
                            {delta !== 0 && (
                              <span className={cn('text-[10px]', delta > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                              </span>
                            )}
                          </button>
                          {overlapNames.length > 0 && (
                            <p className="text-[10px] text-muted-foreground pl-1">
                              also: {overlapNames.join(', ')}{overflow > 0 ? ` +${overflow}` : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground transition-colors font-mono-ui"
              >
                {expanded ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show all {groups.length} attributes <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </>
        )}
      </div>
      <Sheet open={!!selectedAttr} onOpenChange={(o) => { if (!o) setSelectedAttr(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedAttr && (() => {
            const { group, value: v } = selectedAttr;
            const dimLower = group.name.toLowerCase();
            const mentions = v.mentions ?? 0;
            const delta = v.mentions_delta ?? 0;
            const competitors = row?.competitors ?? [];
            const compRanked = (v.competitor_mentions ?? [])
              .map((count, i) => ({ name: competitors[i]?.name ?? `Competitor ${i + 1}`, count: count ?? 0 }))
              .filter(x => x.count > 0)
              .sort((a, b) => b.count - a.count);
            const topCompCount = compRanked[0]?.count ?? 0;
            const leadsOrTies = mentions >= topCompCount;
            const insight = compRanked.length === 0
              ? `No competitors were described this way — this is a distinctive association for ${clientName}.`
              : leadsOrTies
                ? `This is a strength ${clientName} is associated with more than most competitors.`
                : `Competitors currently own this association more strongly — an opportunity to reinforce it in earned coverage.`;
            return (
              <div className="space-y-6">
                <SheetHeader className="space-y-2 text-left">
                  <p className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                    {group.name}
                  </p>
                  <SheetTitle className="text-2xl font-medium tracking-tight" style={{ color: accent }}>
                    {v.value}
                  </SheetTitle>
                </SheetHeader>

                <p className="text-sm leading-relaxed text-foreground">
                  Across AI assistants this period, {clientName}'s {dimLower} was described as
                  {' '}&ldquo;{v.value}&rdquo; in {mentions} response{mentions === 1 ? '' : 's'}.
                </p>

                <div className="text-[12px]">
                  {delta > 0 && <span className="text-emerald-600">▲ Up {delta} vs the prior period</span>}
                  {delta < 0 && <span className="text-rose-600">▼ Down {Math.abs(delta)} vs the prior period</span>}
                  {delta === 0 && <span className="text-muted-foreground">No change vs the prior period.</span>}
                </div>

                <div>
                  <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                    How often competitors are described this way
                  </p>
                  {compRanked.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">
                      No competitors were described this way — this is a distinctive association for {clientName}.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      <li className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md" style={{ backgroundColor: `${accent}10`, border: `1px solid ${accent}33` }}>
                        <span className="font-medium" style={{ color: accent }}>{clientName} (you)</span>
                        <span className="font-mono-ui" style={{ color: accent }}>{mentions}</span>
                      </li>
                      {compRanked.map((c, i) => (
                        <li key={i} className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md bg-muted/40">
                          <span>{c.name}</span>
                          <span className="font-mono-ui text-muted-foreground">{c.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                    What this means
                  </p>
                  <p className="text-[13px] leading-relaxed text-foreground">{insight}</p>
                </div>

                {windowLabel && (
                  <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/60">
                    Perception window: {windowLabel}
                  </p>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </section>
  );
};


// ---------- AI Shopping Visibility ----------
interface ShoppingProductRow {
  product_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  visibility: number | null;
  share_of_voice: number | null;
  avg_position: number | null;
  mention_count: number | null;
  win_count: number | null;
  price_range: Record<string, { min: number; max: number }> | null;
  categories: string[] | null;
  captured_date: string | null;
}

const fmtPriceRange = (pr: ShoppingProductRow['price_range']): string | null => {
  if (!pr || typeof pr !== 'object') return null;
  const entries = Object.entries(pr);
  if (entries.length === 0) return null;
  const usd = pr['USD'];
  const [currency, range] = usd ? ['USD', usd] : entries[0];
  if (!range || range.min == null || range.max == null) return null;
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString()}${sym ? '' : ' ' + currency}`;
  return range.min === range.max ? fmt(range.min) : `${fmt(range.min)}–${fmt(range.max)}`;
};

const AiShoppingVisibilitySection = ({ clientId, accent }: { clientId: string | null; accent: string }) => {
  const [rows, setRows] = useState<ShoppingProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ShoppingProductRow | null>(null);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('peec_products_latest', { p_client_id: clientId, p_limit: 24 });
        if (error) throw error;
        const list: ShoppingProductRow[] = Array.isArray(data) ? data : [];
        list.sort((a, b) => (b.visibility ?? 0) - (a.visibility ?? 0));
        if (!cancelled) setRows(list);
      } catch (e) {
        console.error('[AiShoppingVisibility] load failed', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <section className="border border-border bg-card p-6">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">AI Shopping Visibility</h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </section>
    );
  }

  if (!rows.length) return null;

  const captured = rows.find(r => r.captured_date)?.captured_date;
  const capturedLabel = captured && !isNaN(new Date(captured).getTime())
    ? new Date(captured).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const visible = expanded ? rows : rows.slice(0, 8);
  const hasMore = rows.length > 8;

  return (
    <section className="border border-border bg-card">
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI Shopping Visibility</div>
          <div className="text-sm text-foreground mt-1">Which of your products AI recommends most</div>
        </div>
        {capturedLabel && (
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            As of {capturedLabel}
          </div>
        )}
      </div>

      <ol className="divide-y divide-border">
        {visible.map((p, idx) => {
          const pct = Math.round((p.visibility ?? 0) * 100);
          const isTop = idx === 0;
          const initial = (p.name?.trim()?.[0] ?? '?').toUpperCase();
          return (
            <li key={p.product_id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full grid grid-cols-[28px_44px_1fr_auto] gap-4 items-center px-6 py-3 text-left hover:bg-muted/40 transition-colors ${isTop ? 'bg-muted/30' : ''}`}
              >
                <div className={`font-mono text-sm tabular-nums ${isTop ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                  {idx + 1}
                </div>
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted" loading="lazy" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className={`truncate text-sm ${isTop ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                    {p.name}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 max-w-[260px] rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-muted-foreground w-10 text-right">
                      {pct}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <span>Avg {p.avg_position != null ? `#${Number(p.avg_position).toFixed(1)}` : '—'}</span>
                  <span>{(p.mention_count ?? 0).toLocaleString()} mentions</span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <div className="px-6 py-3 border-t border-border">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <>Show less <ChevronUp className="h-3 w-3" /></> : <>Show all {rows.length} products <ChevronDown className="h-3 w-3" /></>}
          </button>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (() => {
            const vis = Math.round((selected.visibility ?? 0) * 100);
            const sov = Math.round((selected.share_of_voice ?? 0) * 100);
            const price = fmtPriceRange(selected.price_range);
            const initial = (selected.name?.trim()?.[0] ?? '?').toUpperCase();
            return (
              <div className="space-y-6">
                <SheetHeader>
                  <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">AI Shopping</div>
                  <SheetTitle className="text-xl leading-tight">{selected.name}</SheetTitle>
                  {selected.brand && (
                    <div className="text-sm text-muted-foreground">{selected.brand}</div>
                  )}
                </SheetHeader>

                {selected.image_url ? (
                  <img src={selected.image_url} alt="" className="w-full h-56 rounded object-cover bg-muted" />
                ) : (
                  <div className="w-full h-56 rounded bg-muted flex items-center justify-center text-5xl font-semibold text-muted-foreground">
                    {initial}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-px bg-border border border-border">
                  {[
                    { label: 'Visibility', value: `${vis}%` },
                    { label: 'Share of Voice', value: `${sov}%` },
                    { label: 'Avg Position', value: selected.avg_position != null ? `#${Number(selected.avg_position).toFixed(1)}` : '—' },
                    { label: 'Mentions', value: (selected.mention_count ?? 0).toLocaleString() },
                    { label: 'Wins', value: (selected.win_count ?? 0).toLocaleString() },
                    ...(price ? [{ label: 'Price range', value: price }] : []),
                  ].map((s) => (
                    <div key={s.label} className="bg-card p-3">
                      <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{s.label}</div>
                      <div className="text-base font-semibold text-foreground mt-1 tabular-nums">{s.value}</div>
                    </div>
                  ))}
                </div>

                {selected.categories && selected.categories.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-2">Categories</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.categories.map((c) => (
                        <span key={c} className="text-[11px] px-2 py-0.5 border border-border rounded-sm text-foreground">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selected.name} appeared in {(selected.mention_count ?? 0).toLocaleString()} AI shopping answers this period
                  {selected.avg_position != null ? `, ranking on average at position ${Number(selected.avg_position).toFixed(1)}` : ''}.
                </p>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </section>
  );
};





// ---------- Executive Summary ----------
interface SummaryRow {
  headline: string | null;
  narrative: string | null;
  drivers: string[] | null;
  watch_items: string[] | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
}

const safeDate = (v: string | null | undefined) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
const fmtMD = (v: string | null | undefined) => {
  const d = safeDate(v);
  return d ? format(d, 'MMM d') : '';
};

const ExecutiveSummarySection = ({
  clientId, accent, isAdmin,
}: { clientId: string; accent: string; isAdmin: boolean }) => {
  const [row, setRow] = useState<SummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: e } = await supabase.rpc('ai_visibility_summary_latest', {
          p_client_id: clientId, p_period_type: 'week',
        });
        if (cancelled) return;
        if (e) throw e;
        const first = Array.isArray(data) && data.length > 0 ? (data[0] as SummaryRow) : null;
        setRow(first);
      } catch (err: any) {
        if (!cancelled) { console.error('ai_visibility_summary_latest failed:', err); setRow(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, tick]);

  const regenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('ai-visibility-summary', {
        body: { client_id: clientId, period_type: 'week', force: true },
      });
      if (e) throw e;
      if (data && (data as any).empty) {
        setRow(null);
      } else {
        setTick(t => t + 1);
      }
    } catch (err: any) {
      console.error('ai-visibility-summary invoke failed:', err);
      setError('Could not regenerate summary. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const periodLabel = row
    ? [fmtMD(row.period_start), fmtMD(row.period_end)].filter(Boolean).join(' – ')
    : '';

  const generatedAt = row ? safeDate(row.created_at) : null;
  const narrativeParas = (row?.narrative ?? '').split(/\n{2,}/).filter(Boolean);
  const drivers = (row?.drivers ?? []).filter(Boolean);
  const watch = (row?.watch_items ?? []).filter(Boolean);

  return (
    <section
      className="bg-card border border-border rounded-sm relative overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground"
              style={{ color: accent }}
            >
              AI Visibility — Executive Summary
            </span>
          </div>
          <div className="flex items-center gap-3">
            {periodLabel && (
              <span className="text-[10px] font-mono tracking-[0.1em] uppercase text-muted-foreground">
                {periodLabel}
              </span>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] tracking-[0.1em] uppercase"
                disabled={regenerating}
                onClick={regenerate}
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </Button>
            )}
          </div>
        </div>

        {loading || regenerating ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            {regenerating && (
              <p className="text-xs text-muted-foreground italic pt-2">
                Generating the latest weekly summary… this takes 10–15 seconds.
              </p>
            )}
          </div>
        ) : !row ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Your weekly AI visibility summary will appear here once generated.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {row.headline && (
              <h2 className="font-display text-2xl md:text-3xl leading-tight tracking-tight text-foreground">
                {row.headline}
              </h2>
            )}
            {narrativeParas.length > 0 && (
              <div className="space-y-3 max-w-3xl">
                <p className="text-sm md:text-[15px] leading-relaxed text-foreground/85">
                  {narrativeParas[0]}
                </p>
                {expanded && narrativeParas.slice(1).map((p, i) => (
                  <p key={i} className="text-sm md:text-[15px] leading-relaxed text-foreground/85">
                    {p}
                  </p>
                ))}
              </div>
            )}
            {expanded && drivers.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-2">
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
            {expanded && watch.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-2">
                  Watch
                </h3>
                <ul className="space-y-1.5">
                  {watch.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/90">
                      <span className="text-amber-600 font-mono mt-0.5">▲</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(narrativeParas.length > 1 || drivers.length > 0 || watch.length > 0) && (
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground transition-colors font-mono-ui"
              >
                {expanded ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
            {expanded && generatedAt && (
              <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground pt-2 border-t border-border">
                Generated {format(generatedAt, 'MMM d, yyyy · h:mm a')}
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
};

// ---------- What AI Is Saying About You (pull-quotes) ----------
interface PullQuote { text: string; platform: string; date: string; sentiment: number | null }

const extractMentionSentences = (text: string, brand: string): string[] => {
  if (!text || !brand) return [];
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const lc = brand.toLowerCase();
  return sentences.filter(s => s.toLowerCase().includes(lc));
};

const PullQuotesSection = ({
  clientId, p_start, p_end, clientName,
}: { clientId: string; p_start: string; p_end: string; clientName: string | null }) => {
  const [quotes, setQuotes] = useState<PullQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('peec_chats_page', {
          p_client_id: clientId,
          p_start, p_end,
          p_only_mentioned: true,
          p_platform: 'all',
          p_limit: 40,
          p_offset: 0,
        });
        if (cancelled) return;
        if (error) throw error;
        const rows = (data ?? []) as ChatRow[];
        const brand = clientName ?? '';
        const collected: PullQuote[] = [];
        const seen = new Set<string>();
        for (const r of rows) {
          const sents = extractMentionSentences(r.response_text ?? '', brand).slice(0, 2);
          for (const s of sents) {
            const key = s.replace(/\s+/g, ' ').toLowerCase().slice(0, 120);
            if (seen.has(key)) continue;
            seen.add(key);
            const brandEntry = (r.brands_mentioned ?? []).find(
              b => b.name && b.name.toLowerCase() === brand.toLowerCase(),
            );
            collected.push({
              text: s,
              platform: r.platform,
              date: r.date,
              sentiment: brandEntry?.sentiment ?? null,
            });
            if (collected.length >= 10) break;
          }
          if (collected.length >= 10) break;
        }
        setQuotes(collected);
      } catch (err) {
        console.error('pull-quotes fetch failed:', err);
        if (!cancelled) setQuotes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, p_start, p_end, clientName]);

  const sentimentEdge = (s: number | null) => {
    if (s == null) return 'border-l-transparent';
    if (s > 0.15) return 'border-l-emerald-500';
    if (s < -0.15) return 'border-l-red-500';
    return 'border-l-slate-300';
  };

  return (
    <section className="bg-card border border-border rounded-sm p-6">
      <div className="mb-5">
        <h3 className="font-display text-xl tracking-tight text-foreground">What AI Is Saying About You</h3>
        <p className="text-[11px] font-mono tracking-[0.1em] uppercase text-muted-foreground mt-1">
          Verbatim mentions from AI assistants
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No brand mentions to quote in this period yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quotes.map((q, i) => {
            const d = safeDate(q.date);
            return (
              <figure
                key={i}
                className={cn(
                  'bg-background border border-border border-l-4 p-5 flex flex-col gap-4',
                  sentimentEdge(q.sentiment),
                )}
              >
                <blockquote className="font-display italic text-[15px] leading-relaxed text-foreground/90 relative">
                  <span className="text-3xl leading-none text-muted-foreground mr-1 align-top">“</span>
                  {q.text}
                  <span className="text-2xl leading-none text-muted-foreground ml-0.5">”</span>
                </blockquote>
                <figcaption className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                  <span className={cn('px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] uppercase', platformPillCls(q.platform))}>
                    {platformLabel(q.platform)}
                  </span>
                  <span className="text-[10px] font-mono tracking-[0.1em] uppercase text-muted-foreground">
                    {d ? format(d, 'MMM d, yyyy') : ''}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
};





// ---------- Main ----------
const AIVisibilityTab = () => {
  const { activeClientId, refreshKey } = useWeek();
  const { clientName: ownClientName, isAdmin, allClients, clientColor } = useAdmin();
  const activeClientName = useMemo(() => {
    const match = allClients.find(c => c.id === activeClientId);
    return match?.name ?? ownClientName;
  }, [allClients, activeClientId, ownClientName]);
  const clientName = activeClientName;
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
      <ExecutiveSummarySection
        clientId={activeClientId}
        accent={clientColor || '#1B2B8A'}
        isAdmin={isAdmin}
      />
      <PlatformScoreCards
        rows={platformScores}
        loading={loading.platformScores}
        clientId={activeClientId}
        pStart={p_start}
        pEnd={p_end}
        clientName={clientName}

        onApplyPlatformFilter={(p) => setPlatform(p as Platform)}
      />
      <BrandAttributesSection clientId={activeClientId} accent={clientColor || '#1B2B8A'} clientName={clientName || 'your brand'} />
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
      <AiShoppingVisibilitySection clientId={activeClientId} accent={clientColor || '#1B2B8A'} />
      <PullQuotesSection
        clientId={activeClientId}
        p_start={p_start}
        p_end={p_end}
        clientName={clientName}
      />

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
