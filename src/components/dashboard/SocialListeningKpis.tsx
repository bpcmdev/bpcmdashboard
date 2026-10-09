/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, DollarSign, Eye, Frown, Globe, Heart, Share2, Smile, Users, X, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------------------------------
 * Social Listening — interactive overview cards.
 * Each card shows the number, its change, and a 30-day sparkline. Selecting a card opens a panel
 * directly under its row with the daily trend, where it comes from, and a plain-English read-out.
 * RPC: listening_overview_series (daily totals + per-source totals). Headline numbers come from the
 * parent's listening_overview result.
 * ---------------------------------------------------------------------------------------------- */

type Key =
  | 'mentions' | 'reach' | 'positive' | 'negative' | 'ave'
  | 'social_mentions' | 'non_social_mentions' | 'social_interactions'
  | 'social_reach' | 'non_social_reach' | 'social_reactions' | 'social_shares';

type Field = 'mentions' | 'reach' | 'positive' | 'negative' | 'ave' | 'likes' | 'shares' | 'interactions';

interface Metric {
  key: Key;
  label: string;
  icon: LucideIcon;
  hue: number;
  field: Field;
  scope: 'all' | 'social' | 'nonsocial';
  money?: boolean;
  invert?: boolean;
  blurb: string;
}

type DayRow = { date: string } & Record<Key, number>;

interface SrcRow {
  source: string; mentions: number; reach: number; positive: number; negative: number;
  ave: number; likes: number; comments: number; shares: number;
}

interface Series { days: DayRow[]; by_source: SrcRow[] }

interface OverviewLike {
  data_since: string | null;
  current: Partial<Record<Key, number>>;
  prior: Partial<Record<Key, number>> | null;
}

const METRICS: Metric[] = [
  { key: 'mentions', label: 'Total mentions', icon: Activity, hue: 255, field: 'mentions', scope: 'all',
    blurb: 'Every public post, video or article that matched your keywords, across all channels.' },
  { key: 'reach', label: 'Total reach', icon: Eye, hue: 200, field: 'reach', scope: 'all',
    blurb: 'The estimated audience that could have seen those mentions. One viral post can swing this number.' },
  { key: 'positive', label: 'Positive mentions', icon: Smile, hue: 150, field: 'positive', scope: 'all',
    blurb: 'Mentions the listening tool scored as positive in tone. Most posts are neutral, so this is the enthusiastic slice.' },
  { key: 'negative', label: 'Negative mentions', icon: Frown, hue: 350, field: 'negative', scope: 'all', invert: true,
    blurb: 'Mentions scored as negative in tone. Lower is better. Worth a look whenever it spikes.' },
  { key: 'ave', label: 'Advertising value (AVE)', icon: DollarSign, hue: 38, field: 'ave', scope: 'all', money: true,
    blurb: 'A rough estimate of what it would cost to buy the same exposure as paid advertising. Useful for scale, not an exact figure.' },
  { key: 'social_mentions', label: 'Social media mentions', icon: Users, hue: 320, field: 'mentions', scope: 'social',
    blurb: 'Posts on TikTok, YouTube, X, Instagram and Facebook.' },
  { key: 'non_social_mentions', label: 'Non-social mentions', icon: Globe, hue: 175, field: 'mentions', scope: 'nonsocial',
    blurb: 'News, Reddit, blogs, forums and podcasts: the conversation that happens outside the social feeds.' },
  { key: 'social_interactions', label: 'Total social interactions', icon: Zap, hue: 20, field: 'interactions', scope: 'social',
    blurb: 'Likes, comments and shares on social posts. A gauge of how much people actually engaged, not just scrolled past.' },
  { key: 'social_reach', label: 'Social media reach', icon: Eye, hue: 280, field: 'reach', scope: 'social',
    blurb: 'Estimated audience of the social posts that mention the brand.' },
  { key: 'non_social_reach', label: 'Non-social reach', icon: Globe, hue: 215, field: 'reach', scope: 'nonsocial',
    blurb: 'Estimated audience of the news, Reddit, blog and forum mentions.' },
  { key: 'social_reactions', label: 'Social reactions', icon: Heart, hue: 340, field: 'likes', scope: 'social',
    blurb: 'Likes and other reactions on social posts that mention the brand.' },
  { key: 'social_shares', label: 'Social shares', icon: Share2, hue: 165, field: 'shares', scope: 'social',
    blurb: 'How often people passed those posts on. Shares are the strongest sign that something resonates.' },
];

const SOCIAL = new Set(['twitter', 'x', 'facebook', 'instagram', 'tiktok', 'youtube']);

const SOURCES: Record<string, { label: string; color: string }> = {
  tiktok:    { label: 'TikTok',    color: 'hsl(174 60% 33%)' },
  twitter:   { label: 'X',         color: 'hsl(0 0% 20%)' },
  x:         { label: 'X',         color: 'hsl(0 0% 20%)' },
  youtube:   { label: 'YouTube',   color: 'hsl(0 72% 46%)' },
  reddit:    { label: 'Reddit',    color: 'hsl(16 85% 50%)' },
  instagram: { label: 'Instagram', color: 'hsl(330 65% 48%)' },
  facebook:  { label: 'Facebook',  color: 'hsl(214 80% 48%)' },
  news:      { label: 'News',      color: 'hsl(225 70% 35%)' },
  other:     { label: 'Blogs, web & podcasts', color: 'hsl(42 64% 45%)' },
};
const sourceMeta = (s: string) => SOURCES[s] ?? { label: s.charAt(0).toUpperCase() + s.slice(1), color: 'hsl(0 0% 60%)' };

const accent = (h: number, l = 42) => `hsl(${h} 72% ${l}%)`;
const tint = (h: number, a: number) => `hsl(${h} 85% 50% / ${a})`;

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Full number below 10,000 (so 1,603 doesn't become "2K"), compact above. */
function fmt(n: number): string {
  const v = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e9) return `${sign}${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${sign}${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${sign}${Math.round(v / 1e3)}K`;
  return `${sign}${Math.round(v).toLocaleString('en-US')}`;
}
const fmtVal = (m: Metric, n: number) => (m.money ? `$${fmt(n)}` : fmt(n));

const KEYS: Key[] = METRICS.map(m => m.key);

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDay(d: string, withYear = false): string {
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}

/** Fills quiet days with zeros and trims the empty stretch before the first mention, so charts start where data does. */
function buildDays(days: DayRow[], start: string | null, end: string | null): DayRow[] {
  const byDate = new Map(days.map(d => [String(d.date).slice(0, 10), d]));
  let from = start;
  let to = end;
  if (!from || !to) {
    if (!days.length) return [];
    from = String(days[0].date).slice(0, 10);
    to = String(days[days.length - 1].date).slice(0, 10);
  }
  const zero = (date: string): DayRow => {
    const row: any = { date };
    KEYS.forEach(k => { row[k] = 0; });
    return row as DayRow;
  };
  const out: DayRow[] = [];
  const cur = new Date(from + 'T00:00:00');
  const last = new Date(to + 'T00:00:00');
  let guard = 0;
  while (cur <= last && guard++ < 800) {
    const k = ymd(cur);
    const hit = byDate.get(k);
    out.push(hit ? { ...hit, date: k } : zero(k));
    cur.setDate(cur.getDate() + 1);
  }
  const first = out.findIndex(d => KEYS.some(k => num(d[k]) > 0));
  return first > 0 ? out.slice(first) : out;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useCountUp(target: number, ms = 800): number {
  const reduced = usePrefersReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return v;
}

/** Matches the Tailwind grid below (2 / 3 / 4 columns) so the detail panel opens under the clicked card's row. */
function useColumns(): number {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const calc = () => setCols(window.innerWidth < 768 ? 2 : window.innerWidth < 1024 ? 3 : 4);
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return cols;
}

function Delta({ current, prior, invert = false }: { current: number; prior: number | null | undefined; invert?: boolean }) {
  if (prior == null) return null;
  if (prior === 0) return current ? <span className="text-[10px] font-bold text-muted-foreground">New</span> : null;
  const pct = ((current - prior) / prior) * 100;
  if (!Number.isFinite(pct) || Math.round(pct) === 0) return <span className="text-[10px] text-muted-foreground">Stable</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5', good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {up ? '↑' : '↓'} {Math.abs(Math.round(pct))}%
    </span>
  );
}

function AnimatedValue({ m, value }: { m: Metric; value: number }) {
  const v = useCountUp(value);
  return <>{fmtVal(m, v)}</>;
}

function Sparkline({ m, days }: { m: Metric; days: DayRow[] }) {
  if (days.length < 2) return <div className="h-10" aria-hidden />;
  const id = `kpi-spark-${m.key}`;
  return (
    <div className="h-10 -mx-1" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={days} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent(m.hue)} stopOpacity={0.45} />
              <stop offset="100%" stopColor={accent(m.hue)} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, 'dataMax']} />
          <Area type="monotone" dataKey={m.key} stroke={accent(m.hue)} strokeWidth={1.75} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function breakdownFor(m: Metric, rows: SrcRow[]): { source: string; value: number }[] {
  return rows
    .filter(r => (m.scope === 'all' ? true : m.scope === 'social' ? SOCIAL.has(r.source) : !SOCIAL.has(r.source)))
    .map(r => ({
      source: r.source,
      value: m.field === 'interactions' ? num(r.likes) + num(r.comments) + num(r.shares) : num((r as any)[m.field]),
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

function Detail({ m, value, prior, days, bySource, totalMentions, onClose }: {
  m: Metric; value: number; prior: number | null; days: DayRow[]; bySource: SrcRow[]; totalMentions: number; onClose: () => void;
}) {
  const Icon = m.icon;
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [m.key]);

  const breakdown = useMemo(() => breakdownFor(m, bySource), [m, bySource]);
  const breakTotal = breakdown.reduce((s, r) => s + r.value, 0);
  const maxBar = breakdown.length ? breakdown[0].value : 0;

  const stats = useMemo(() => {
    const n = days.length;
    const series = days.map(d => num(d[m.key]));
    const total = series.reduce((s, v) => s + v, 0);
    let peakIdx = -1;
    series.forEach((v, i) => { if (peakIdx < 0 || v > series[peakIdx]) peakIdx = i; });
    const peak = peakIdx >= 0 ? { date: days[peakIdx].date, v: series[peakIdx] } : null;
    const avg = n ? total / n : 0;
    let momentum: number | null = null;
    if (n >= 6) {
      const half = Math.floor(n / 2);
      const a = series.slice(0, half).reduce((s, v) => s + v, 0) / half;
      const b = series.slice(n - half).reduce((s, v) => s + v, 0) / half;
      if (a > 0) momentum = ((b - a) / a) * 100;
    }
    return { n, total, peak, avg, momentum };
  }, [days, m.key]);

  const insights = useMemo(() => {
    const out: string[] = [];
    const base = stats.total || value;
    if (stats.peak && stats.peak.v > 0 && base > 0) {
      const share = (stats.peak.v / base) * 100;
      if (share >= 25 && (m.key === 'reach' || m.key === 'social_reach' || m.key === 'ave' || m.key === 'social_interactions' || m.key === 'social_reactions')) {
        out.push(`One day (${formatDay(stats.peak.date)}) carried ${Math.round(share)}% of the total. That's a standout moment, not a steady baseline.`);
      } else {
        out.push(`Biggest day: ${formatDay(stats.peak.date)}, with ${fmtVal(m, stats.peak.v)}.`);
      }
    }
    if (breakdown.length && breakTotal > 0) {
      const top = breakdown[0];
      out.push(`${sourceMeta(top.source).label} drives ${Math.round((top.value / breakTotal) * 100)}% of this.`);
    }
    if (stats.momentum != null && Math.abs(stats.momentum) >= 5) {
      out.push(`The second half of the period is running ${Math.round(Math.abs(stats.momentum))}% ${stats.momentum > 0 ? 'higher' : 'lower'} than the first half.`);
    }
    if ((m.key === 'positive' || m.key === 'negative') && totalMentions > 0) {
      out.push(`That's ${((value / totalMentions) * 100).toFixed(1)}% of all mentions.`);
    }
    if (m.key === 'social_mentions' || m.key === 'non_social_mentions') {
      if (totalMentions > 0) out.push(`${Math.round((value / totalMentions) * 100)}% of the conversation sits here.`);
    }
    return out.slice(0, 4);
  }, [stats, breakdown, breakTotal, m, value, totalMentions]);

  const gradId = `kpi-detail-${m.key}`;

  return (
    <div
      id="listening-kpi-detail"
      role="region"
      aria-label={`${m.label} details`}
      className="col-span-full border animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        borderColor: tint(m.hue, 0.35),
        borderTop: `3px solid ${accent(m.hue)}`,
        background: `linear-gradient(180deg, ${tint(m.hue, 0.07)}, transparent 60%)`,
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: tint(m.hue, 0.14), color: accent(m.hue) }}>
              <Icon className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: accent(m.hue) }}>{m.label}</p>
              <p className="font-display text-3xl font-bold tabular-nums leading-tight">
                {fmtVal(m, value)}
                <span className="ml-3 align-middle"><Delta current={value} prior={prior} invert={m.invert} /></span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mt-3 max-w-3xl">{m.blurb}</p>

        <div className="grid gap-6 lg:grid-cols-5 mt-5">
          <div className="lg:col-span-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily average</p>
                <p className="text-sm font-bold tabular-nums">{fmtVal(m, stats.avg)}</p>
              </div>
              {stats.peak && stats.peak.v > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peak day</p>
                  <p className="text-sm font-bold tabular-nums">{fmtVal(m, stats.peak.v)} <span className="font-normal text-muted-foreground">on {formatDay(stats.peak.date)}</span></p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Days tracked</p>
                <p className="text-sm font-bold tabular-nums">{stats.n}</p>
              </div>
            </div>
            {days.length >= 2 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={days} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent(m.hue)} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={accent(m.hue)} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d)} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} minTickGap={28} />
                  <YAxis tickFormatter={(v: number) => (m.money ? `$${fmt(v)}` : fmt(v))} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    labelFormatter={(d: string) => formatDay(d, true)}
                    formatter={(v: number) => [fmtVal(m, num(v)), m.label]}
                    contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, color: 'white', fontSize: 11 }}
                    cursor={{ stroke: accent(m.hue), strokeOpacity: 0.4 }}
                  />
                  {stats.n >= 3 && stats.avg > 0 && <ReferenceLine y={stats.avg} stroke={accent(m.hue)} strokeDasharray="4 4" strokeOpacity={0.55} />}
                  <Area type="monotone" dataKey={m.key} stroke={accent(m.hue)} strokeWidth={2.25} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: accent(m.hue) }} isAnimationActive={!reduced} animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Not enough days of data yet to draw a trend.</p>
            )}
          </div>

          <div className="lg:col-span-2">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-3">Where it comes from</p>
            {breakdown.length ? (
              <ul className="space-y-2.5">
                {breakdown.map(r => {
                  const meta = sourceMeta(r.source);
                  const width = maxBar ? (r.value / maxBar) * 100 : 0;
                  return (
                    <li key={r.source}>
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <span className="font-semibold">{meta.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtVal(m, r.value)} <span className="font-semibold text-foreground">{breakTotal ? Math.round((r.value / breakTotal) * 100) : 0}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: ready || reduced ? `${width}%` : '0%',
                            backgroundColor: meta.color,
                            transition: reduced ? undefined : 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No breakdown available for this period.</p>
            )}
          </div>
        </div>

        {insights.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {insights.map(t => (
              <li key={t} className="text-xs px-3 py-1.5" style={{ background: tint(m.hue, 0.09), color: 'hsl(0 0% 20%)' }}>
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============================================================================================== */

const SocialListeningKpis = ({ overview }: { overview: OverviewLike }) => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const cols = useColumns();
  const [series, setSeries] = useState<Series | null>(null);
  const [selected, setSelected] = useState<Key | null>(null);

  const range = useMemo(() => {
    if (isAllTime || !effectiveFrom || !effectiveTo) return { p_start: null as string | null, p_end: null as string | null };
    return { p_start: effectiveFrom as string, p_end: effectiveTo as string };
  }, [isAllTime, effectiveFrom, effectiveTo]);

  useEffect(() => {
    if (!activeClientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('listening_overview_series' as any, { p_client_id: activeClientId, ...range });
      if (cancelled) return;
      if (error) {
        console.error('listening_overview_series failed:', error);
        setSeries(null);
        return;
      }
      const d = (data ?? {}) as Partial<Series>;
      setSeries({ days: arr<DayRow>(d.days), by_source: arr<SrcRow>(d.by_source) });
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const days = useMemo(() => buildDays(arr<DayRow>(series?.days), range.p_start, range.p_end), [series, range]);
  const bySource = useMemo(() => arr<SrcRow>(series?.by_source), [series]);

  const cur = overview.current;
  const prior = overview.prior;
  const selectedIdx = selected ? METRICS.findIndex(m => m.key === selected) : -1;
  const insertAfter = selectedIdx >= 0 ? Math.min(METRICS.length - 1, (Math.floor(selectedIdx / cols) + 1) * cols - 1) : -1;

  return (
    <div className="section-card border overflow-hidden">
      <div
        className="h-1"
        style={{ background: 'linear-gradient(90deg, hsl(255 70% 55%), hsl(200 80% 50%), hsl(150 60% 45%), hsl(38 90% 55%), hsl(350 75% 55%))' }}
        aria-hidden
      />
      <div className="px-5 pt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Overview across all channels</h3>
        <p className="text-[11px] text-muted-foreground">Select a card for the story behind the number</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
        {METRICS.map((m, i) => {
          const Icon = m.icon;
          const value = num(cur[m.key]);
          const active = selected === m.key;
          return (
            <div key={m.key} className="contents">
              <button
                type="button"
                aria-pressed={active}
                aria-expanded={active}
                aria-controls={active ? 'listening-kpi-detail' : undefined}
                onClick={() => setSelected(active ? null : m.key)}
                className={cn(
                  'group relative text-left border bg-card p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  'hover:-translate-y-0.5 hover:shadow-md',
                  active && '-translate-y-0.5 shadow-md',
                )}
                style={{
                  borderTop: `3px solid ${accent(m.hue)}`,
                  borderColor: active ? tint(m.hue, 0.5) : undefined,
                  borderTopColor: accent(m.hue),
                  background: active
                    ? `linear-gradient(165deg, ${tint(m.hue, 0.14)}, ${tint(m.hue, 0.03)})`
                    : `linear-gradient(165deg, ${tint(m.hue, 0.05)}, transparent 70%)`,
                  boxShadow: active ? `0 6px 18px -8px ${tint(m.hue, 0.55)}` : undefined,
                  ['--tw-ring-color' as any]: accent(m.hue),
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold min-w-0" style={{ color: accent(m.hue, 36) }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: tint(m.hue, 0.14) }}>
                      <Icon className="w-3.5 h-3.5" aria-hidden />
                    </span>
                    <span className="truncate">{m.label}</span>
                  </span>
                  <Delta current={value} prior={prior ? num(prior[m.key]) : null} invert={m.invert} />
                </div>
                <p className="text-2xl font-bold tabular-nums mt-3 leading-none"><AnimatedValue m={m} value={value} /></p>
                <div className="mt-2"><Sparkline m={m} days={days} /></div>
                <p className="text-[10px] text-muted-foreground mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  {active ? 'Click to close' : 'Click for details'}
                </p>
              </button>

              {i === insertAfter && selected && (
                <Detail
                  m={METRICS[selectedIdx]}
                  value={num(cur[selected])}
                  prior={prior ? num(prior[selected]) : null}
                  days={days}
                  bySource={bySource}
                  totalMentions={num(cur.mentions)}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {!prior && overview.data_since && (
        <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
          Period-over-period changes appear once listening data covers the previous period (data starts {new Date(overview.data_since + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).
        </p>
      )}
    </div>
  );
};

export default SocialListeningKpis;