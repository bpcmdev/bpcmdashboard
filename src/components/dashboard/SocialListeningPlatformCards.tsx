/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ExternalLink, MessageSquare, Mic, Newspaper, Radio, Rss, X, Youtube } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------------------------------
 * Social Listening — interactive platform cards (Reddit, YouTube, podcasts, Substack, blogs).
 * Each card shows the count, its change, sentiment and a sparkline. Selecting a card opens a panel under
 * its row with the trend, the sentiment split, a read-out and the latest mentions.
 * RPC: listening_mentions_feed (latest mentions). Everything else arrives from the parent as props.
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

interface TrendResp {
  bucket: 'day' | 'week';
  series: { date: string; platform: Group; mentions: number }[];
}

interface FeedRow {
  mention_key: string;
  title: string | null;
  content: string | null;
  url: string | null;
  host: string | null;
  sentiment: number | null;
  published_date: string;
  author_name: string | null;
}

interface Props {
  clientId: string | null;
  platforms: PlatformStat[];
  trend: TrendResp | null;
  range: { p_start: string | null; p_end: string | null };
  onViewFeed: (g: Group) => void;
}

const META: Record<Group, { label: string; hue: number; icon: LucideIcon; blurb: string }> = {
  reddit: {
    label: 'Reddit', hue: 16, icon: MessageSquare,
    blurb: 'Public posts and comments from Reddit communities. Unprompted, candid opinion, and the kind of text AI answer engines tend to quote.',
  },
  youtube: {
    label: 'YouTube', hue: 0, icon: Youtube,
    blurb: 'Videos whose titles, descriptions or spoken words mention the brand: reviews, hauls, get-ready-with-me videos and tutorials.',
  },
  podcast: {
    label: 'Podcasts', hue: 268, icon: Mic,
    blurb: 'Podcast episodes that talk about the brand.',
  },
  substack: {
    label: 'Substack', hue: 150, icon: Newspaper,
    blurb: 'Newsletters and long-form writing from independent creators and critics on Substack.',
  },
  blogs_forums: {
    label: 'Blogs & forums', hue: 225, icon: Rss,
    blurb: 'Blogs, forums and other web pages where people write about the brand in their own words.',
  },
  broadcast: {
    label: 'Broadcast', hue: 42, icon: Radio,
    blurb: 'TV and radio segments that mention the brand.',
  },
};

const accent = (h: number, l = 42) => `hsl(${h} 72% ${l}%)`;
const tint = (h: number, a: number) => `hsl(${h} 85% 50% / ${a})`;

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function fmt(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}K`;
  return Math.round(v).toLocaleString('en-US');
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDay(d: string, withYear = false): string {
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
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

/** Matches the Tailwind grid below so the detail panel opens under the clicked card's row. */
function useColumns(count: number): number {
  const [width, setWidth] = useState(1400);
  useEffect(() => {
    const calc = () => setWidth(window.innerWidth);
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  if (width < 768) return 2;
  if (width < 1280) return 3;
  return Math.min(6, Math.max(1, count));
}

const XL_COLS: Record<number, string> = {
  1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6',
};

function Delta({ current, prior }: { current: number; prior: number | null | undefined }) {
  if (prior == null) return null;
  if (prior === 0) return current ? <span className="text-[10px] font-bold text-muted-foreground">New</span> : null;
  const pct = ((current - prior) / prior) * 100;
  if (!Number.isFinite(pct) || Math.round(pct) === 0) return <span className="text-[10px] text-muted-foreground">Stable</span>;
  const up = pct > 0;
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5', up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {up ? '↑' : '↓'} {Math.abs(Math.round(pct))}%
    </span>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const v = useCountUp(value);
  return <>{fmt(v)}</>;
}

/** One value per bucket for the platform, with quiet buckets filled in as zero so the line doesn't skip. */
function seriesFor(trend: TrendResp | null, g: Group): { date: string; mentions: number }[] {
  if (!trend) return [];
  const dates = [...new Set(trend.series.map(p => String(p.date).slice(0, 10)))].sort();
  if (!dates.length) return [];
  const step = trend.bucket === 'week' ? 7 : 1;
  const all: string[] = [];
  const cur = new Date(dates[0] + 'T00:00:00');
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  let guard = 0;
  while (cur <= last && guard++ < 800) {
    all.push(ymd(cur));
    cur.setDate(cur.getDate() + step);
  }
  const map = new Map<string, number>();
  trend.series.filter(p => p.platform === g).forEach(p => map.set(String(p.date).slice(0, 10), num(p.mentions)));
  return all.map(d => ({ date: d, mentions: map.get(d) ?? 0 }));
}

function Sparkline({ g, data }: { g: Group; data: { date: string; mentions: number }[] }) {
  if (data.length < 2) return <div className="h-10" aria-hidden />;
  const { hue } = META[g];
  const id = `plat-spark-${g}`;
  return (
    <div className="h-10 -mx-1" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent(hue)} stopOpacity={0.45} />
              <stop offset="100%" stopColor={accent(hue)} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, 'dataMax']} />
          <Area type="monotone" dataKey="mentions" stroke={accent(hue)} strokeWidth={1.75} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SentimentDot({ value }: { value: number | null }) {
  const label = value == null ? 'Unscored' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : 'Neutral';
  const color = value == null ? 'hsl(0 0% 85%)' : value > 0 ? 'hsl(152 55% 40%)' : value < 0 ? 'hsl(0 70% 50%)' : 'hsl(0 0% 70%)';
  return <span className="inline-block w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: color }} title={label} aria-label={label} />;
}

function Detail({ g, stat, totalMentions, platformCount, data, bucket, clientId, range, onClose, onViewFeed }: {
  g: Group; stat: PlatformStat; totalMentions: number; platformCount: number;
  data: { date: string; mentions: number }[]; bucket: 'day' | 'week';
  clientId: string | null; range: { p_start: string | null; p_end: string | null };
  onClose: () => void; onViewFeed: (g: Group) => void;
}) {
  const meta = META[g];
  const Icon = meta.icon;
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const [latest, setLatest] = useState<FeedRow[] | null>(null);

  useEffect(() => {
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [g]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLatest(null);
    (async () => {
      const { data: d, error } = await supabase.rpc('listening_mentions_feed' as any, {
        p_client_id: clientId, p_start: range.p_start, p_end: range.p_end, p_platform: g, p_limit: 3, p_offset: 0,
      });
      if (cancelled) return;
      if (error) {
        console.error('listening_mentions_feed failed:', error);
        setLatest([]);
        return;
      }
      setLatest(arr<FeedRow>((d as any)?.rows));
    })();
    return () => { cancelled = true; };
  }, [clientId, range.p_start, range.p_end, g]);

  const total = stat.positive + stat.neutral + stat.negative;
  const sentiment = [
    { label: 'Positive', n: stat.positive, color: 'hsl(152 55% 40%)' },
    { label: 'Neutral', n: stat.neutral, color: 'hsl(0 0% 78%)' },
    { label: 'Negative', n: stat.negative, color: 'hsl(0 70% 50%)' },
  ];

  const insights = useMemo(() => {
    const out: string[] = [];
    const series = data.map(d => d.mentions);
    const unit = bucket === 'week' ? 'week' : 'day';
    if (series.length) {
      let pi = 0;
      series.forEach((v, i) => { if (v > series[pi]) pi = i; });
      if (series[pi] > 0) {
        out.push(`Busiest ${unit}: ${bucket === 'week' ? 'week of ' : ''}${formatDay(data[pi].date)}, with ${series[pi]} mention${series[pi] === 1 ? '' : 's'}.`);
      }
    }
    if (total > 0) {
      if (stat.negative === 0 && stat.positive > 0) out.push('No negative mentions in this period.');
      else if (stat.positive > stat.negative) out.push(`Positive outnumbers negative ${(stat.positive / Math.max(1, stat.negative)).toFixed(1)} to 1.`);
      else if (stat.negative > stat.positive) out.push('Negative outweighs positive here, so it is worth reading the latest mentions.');
      if (stat.neutral / total >= 0.6) out.push(`${Math.round((stat.neutral / total) * 100)}% of mentions are neutral and factual rather than emotional.`);
    }
    if (series.length >= 4) {
      const half = Math.floor(series.length / 2);
      const a = series.slice(0, half).reduce((s, v) => s + v, 0) / half;
      const b = series.slice(series.length - half).reduce((s, v) => s + v, 0) / half;
      if (a > 0) {
        const pct = ((b - a) / a) * 100;
        if (Math.abs(pct) >= 10) out.push(`The second half of the period is running ${Math.round(Math.abs(pct))}% ${pct > 0 ? 'higher' : 'lower'} than the first.`);
      }
    }
    if (platformCount > 1 && totalMentions > 0) {
      out.push(`${Math.round((stat.mentions / totalMentions) * 100)}% of all alternative-media mentions.`);
    }
    return out.slice(0, 4);
  }, [data, bucket, total, stat, platformCount, totalMentions]);

  const gradId = `plat-detail-${g}`;

  return (
    <div
      id="listening-platform-detail"
      role="region"
      aria-label={`${meta.label} details`}
      className="col-span-full border animate-in fade-in slide-in-from-top-2 duration-300"
      style={{ borderColor: tint(meta.hue, 0.35), borderTop: `3px solid ${accent(meta.hue)}`, background: `linear-gradient(180deg, ${tint(meta.hue, 0.07)}, transparent 60%)` }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: tint(meta.hue, 0.14), color: accent(meta.hue) }}>
              <Icon className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: accent(meta.hue) }}>{meta.label}</p>
              <p className="font-display text-3xl font-bold tabular-nums leading-tight">
                {fmt(stat.mentions)} <span className="text-base font-normal text-muted-foreground">mentions</span>
                <span className="ml-3 align-middle"><Delta current={stat.mentions} prior={stat.prior_mentions} /></span>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 shrink-0">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mt-3 max-w-3xl">{meta.blurb}</p>

        <div className="grid gap-6 lg:grid-cols-5 mt-5">
          <div className="lg:col-span-3">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-2">{bucket === 'week' ? 'Weekly' : 'Daily'} mentions</p>
            {data.length >= 2 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent(meta.hue)} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={accent(meta.hue)} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d)} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} minTickGap={28} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    labelFormatter={(d: string) => (bucket === 'week' ? `Week of ${formatDay(d, true)}` : formatDay(d, true))}
                    formatter={(v: number) => [v, 'Mentions']}
                    contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, color: 'white', fontSize: 11 }}
                    cursor={{ stroke: accent(meta.hue), strokeOpacity: 0.4 }}
                  />
                  <Area type="monotone" dataKey="mentions" stroke={accent(meta.hue)} strokeWidth={2.25} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: accent(meta.hue) }} isAnimationActive={!reduced} animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">Not enough data yet to draw a trend.</p>
            )}
          </div>

          <div className="lg:col-span-2">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-3">How people feel</p>
            <ul className="space-y-2.5">
              {sentiment.map(s => (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-semibold">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.n.toLocaleString('en-US')} <span className="font-semibold text-foreground">{total ? Math.round((s.n / total) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: ready || reduced ? `${total ? (s.n / total) * 100 : 0}%` : '0%',
                        backgroundColor: s.color,
                        transition: reduced ? undefined : 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {!!stat.reach && (
              <p className="text-xs text-muted-foreground mt-4">
                Estimated reach: <span className="font-bold text-foreground tabular-nums">{fmt(stat.reach)}</span>
              </p>
            )}
          </div>
        </div>

        {insights.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {insights.map(t => (
              <li key={t} className="text-xs px-3 py-1.5" style={{ background: tint(meta.hue, 0.09), color: 'hsl(0 0% 20%)' }}>{t}</li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Latest mentions</p>
            <button
              type="button"
              onClick={() => onViewFeed(g)}
              className="inline-flex items-center gap-1 text-xs font-semibold hover:underline focus:outline-none focus-visible:ring-2"
              style={{ color: accent(meta.hue, 36) }}
            >
              See all {fmt(stat.mentions)} in the feed <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
          {latest === null ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2].map(i => <div key={i} className="h-12 bg-muted/60 animate-pulse" />)}
            </div>
          ) : latest.length ? (
            <ul className="divide-y divide-border">
              {latest.map(r => (
                <li key={r.mention_key} className="py-2.5 flex items-start gap-3">
                  <SentimentDot value={r.sentiment} />
                  <div className="min-w-0 flex-1">
                    {r.title && (
                      r.url
                        ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline line-clamp-1 inline-flex items-center gap-1">{r.title}<ExternalLink className="w-3 h-3 shrink-0" aria-hidden /></a>
                        : <p className="text-sm font-semibold line-clamp-1">{r.title}</p>
                    )}
                    {r.content && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.content}</p>}
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.author_name || r.host}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatDay(r.published_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-3">No mentions in this period.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================================== */

const SocialListeningPlatformCards = ({ clientId, platforms, trend, range, onViewFeed }: Props) => {
  const [selected, setSelected] = useState<Group | null>(null);
  const cols = useColumns(platforms.length);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const seriesByGroup = useMemo(() => {
    const m = new Map<Group, { date: string; mentions: number }[]>();
    platforms.forEach(p => m.set(p.platform, seriesFor(trend, p.platform)));
    return m;
  }, [platforms, trend]);

  const totalMentions = platforms.reduce((s, p) => s + num(p.mentions), 0);
  const selectedIdx = selected ? platforms.findIndex(p => p.platform === selected) : -1;
  const insertAfter = selectedIdx >= 0 ? Math.min(platforms.length - 1, (Math.floor(selectedIdx / cols) + 1) * cols - 1) : -1;

  if (!platforms.length) return null;

  return (
    <div className={cn('grid gap-4 grid-cols-2 md:grid-cols-3', XL_COLS[Math.min(6, Math.max(1, platforms.length))])}>
      {platforms.map((p, i) => {
        const meta = META[p.platform];
        const Icon = meta.icon;
        const active = selected === p.platform;
        const scored = p.positive + p.negative + p.neutral;
        const pos = scored ? (p.positive / scored) * 100 : 0;
        const neg = scored ? (p.negative / scored) * 100 : 0;
        return (
          <div key={p.platform} className="contents">
            <button
              type="button"
              aria-pressed={active}
              aria-expanded={active}
              aria-controls={active ? 'listening-platform-detail' : undefined}
              onClick={() => setSelected(active ? null : p.platform)}
              className={cn(
                'group relative text-left border bg-card p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'hover:-translate-y-0.5 hover:shadow-md',
                active && '-translate-y-0.5 shadow-md',
              )}
              style={{
                borderTop: `3px solid ${accent(meta.hue)}`,
                borderColor: active ? tint(meta.hue, 0.5) : undefined,
                borderTopColor: accent(meta.hue),
                background: active
                  ? `linear-gradient(165deg, ${tint(meta.hue, 0.14)}, ${tint(meta.hue, 0.03)})`
                  : `linear-gradient(165deg, ${tint(meta.hue, 0.05)}, transparent 70%)`,
                boxShadow: active ? `0 6px 18px -8px ${tint(meta.hue, 0.55)}` : undefined,
                ['--tw-ring-color' as any]: accent(meta.hue),
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold min-w-0" style={{ color: accent(meta.hue, 36) }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: tint(meta.hue, 0.14) }}>
                    <Icon className="w-3.5 h-3.5" aria-hidden />
                  </span>
                  <span className="truncate">{meta.label}</span>
                </span>
                <Delta current={p.mentions} prior={p.prior_mentions} />
              </div>
              <p className="text-3xl font-bold tabular-nums mt-3 leading-none font-display"><AnimatedCount value={num(p.mentions)} /></p>
              <div className="mt-2"><Sparkline g={p.platform} data={seriesByGroup.get(p.platform) ?? []} /></div>
              <div
                className="flex h-1.5 w-full overflow-hidden bg-muted mt-2"
                role="img"
                aria-label={scored ? `${Math.round(pos)}% positive, ${Math.round(neg)}% negative` : 'No sentiment yet'}
              >
                <div style={{ width: `${pos}%`, backgroundColor: 'hsl(152 55% 40%)' }} />
                <div style={{ width: `${100 - pos - neg}%`, backgroundColor: 'hsl(0 0% 80%)' }} />
                <div style={{ width: `${neg}%`, backgroundColor: 'hsl(0 70% 50%)' }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {scored ? `${Math.round(pos)}% positive` : 'No mentions yet'}
                {p.reach ? `, ${fmt(p.reach)} est. reach` : ''}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                {active ? 'Click to close' : 'Click for details'}
              </p>
            </button>

            {i === insertAfter && selected && selectedIdx >= 0 && (
              <Detail
                g={platforms[selectedIdx].platform}
                stat={platforms[selectedIdx]}
                totalMentions={totalMentions}
                platformCount={platforms.length}
                data={seriesByGroup.get(platforms[selectedIdx].platform) ?? []}
                bucket={trend?.bucket ?? 'day'}
                clientId={clientId}
                range={range}
                onClose={() => setSelected(null)}
                onViewFeed={onViewFeed}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SocialListeningPlatformCards;