/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';

/* ------------------------------------------------------------------------------------------------
 * Social Listening — "Where mentions come from".
 * A hand-drawn SVG donut (no chart-library tooltip): hovering a slice or a legend row lights it up and
 * shows its share in the centre. Selecting one opens a detail card with its trend, sentiment and reach.
 * RPC: listening_overview_series (per-channel totals and daily mentions). The channel counts arrive
 * from the parent's listening_overview result.
 * ---------------------------------------------------------------------------------------------- */

interface SourceRow { source: string; mentions: number; positive: number; negative: number; neutral: number; reach: number }
interface ExtraRow { source: string; mentions: number; reach: number; ave: number; likes: number; comments: number; shares: number }
interface SourceDay { date: string; source: string; mentions: number }

const SOCIAL_SOURCES = new Set(['twitter', 'x', 'facebook', 'instagram', 'tiktok', 'youtube']);
const SOCIAL_COLOR = 'hsl(320 65% 46%)';
const NONSOCIAL_COLOR = 'hsl(175 62% 34%)';

const SOURCES: Record<string, { label: string; color: string }> = {
  tiktok:    { label: 'TikTok',    color: 'hsl(174 62% 33%)' },
  twitter:   { label: 'X',         color: 'hsl(0 0% 22%)' },
  x:         { label: 'X',         color: 'hsl(0 0% 22%)' },
  youtube:   { label: 'YouTube',   color: 'hsl(0 72% 46%)' },
  reddit:    { label: 'Reddit',    color: 'hsl(16 85% 50%)' },
  instagram: { label: 'Instagram', color: 'hsl(330 65% 48%)' },
  facebook:  { label: 'Facebook',  color: 'hsl(214 80% 48%)' },
  news:      { label: 'News',      color: 'hsl(225 70% 35%)' },
  other:     { label: 'Blogs, web & podcasts', color: 'hsl(42 70% 42%)' },
};
const sourceMeta = (s: string) => SOURCES[s] ?? { label: s.charAt(0).toUpperCase() + s.slice(1), color: 'hsl(0 0% 55%)' };

/** hsl(174 62% 33%) -> hsl(174 62% 33% / 0.12) */
const withAlpha = (c: string, a: number) => c.replace(/\)$/, ` / ${a})`);

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function fmt(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}K`;
  return Math.round(v).toLocaleString('en-US');
}

/** 52 -> "52%", 0.47 -> "0.5%" (never a misleading "0%"). */
function pctLabel(p: number): string {
  if (p > 0 && p < 1) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
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

// Donut geometry (SVG units)
const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 78;
const STROKE = 28;
const CIRC = 2 * Math.PI * RADIUS;
const GAP = 3;

/* ============================================================================================== */

const SocialListeningSourceMix = ({ sources }: { sources: SourceRow[] }) => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const reduced = usePrefersReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverGroup, setHoverGroup] = useState<'social' | 'nonsocial' | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [extra, setExtra] = useState<ExtraRow[]>([]);
  const [sourceDays, setSourceDays] = useState<SourceDay[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
        setExtra([]);
        setSourceDays([]);
        return;
      }
      const d = (data ?? {}) as { by_source?: unknown; source_days?: unknown };
      setExtra(arr<ExtraRow>(d.by_source));
      setSourceDays(arr<SourceDay>(d.source_days));
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const rows = useMemo(() => arr<SourceRow>(sources).filter(s => num(s.mentions) > 0).sort((a, b) => num(b.mentions) - num(a.mentions)), [sources]);
  const total = rows.reduce((s, r) => s + num(r.mentions), 0);
  const totalReach = rows.reduce((s, r) => s + num(r.reach), 0);

  const slices = useMemo(() => {
    let acc = 0;
    return rows.map(r => {
      const frac = total ? num(r.mentions) / total : 0;
      const full = frac * CIRC;
      const len = Math.max(full - GAP, 2);
      const slice = { ...r, frac, len, start: acc + GAP / 2, ...sourceMeta(r.source) };
      acc += full;
      return slice;
    });
  }, [rows, total]);

  const socialMentions = slices.filter(s => SOCIAL_SOURCES.has(s.source)).reduce((sum, s) => sum + num(s.mentions), 0);
  const nonSocialMentions = Math.max(0, total - socialMentions);
  const inGroup = (source: string) => (hoverGroup === 'social' ? SOCIAL_SOURCES.has(source) : !SOCIAL_SOURCES.has(source));
  const groupCenter = hoverGroup
    ? { label: hoverGroup === 'social' ? 'Social platforms' : 'Non-social', n: hoverGroup === 'social' ? socialMentions : nonSocialMentions, color: hoverGroup === 'social' ? SOCIAL_COLOR : NONSOCIAL_COLOR }
    : null;

  const activeKey = hover ?? selected;
  const active = activeKey ? slices.find(s => s.source === activeKey) ?? null : null;
  const picked = selected ? slices.find(s => s.source === selected) ?? null : null;

  // ----- detail data for the selected channel -----
  const detail = useMemo(() => {
    if (!picked) return null;
    const ex = extra.find(e => e.source === picked.source);
    const mine = sourceDays.filter(d => d.source === picked.source);
    const allDates = [...new Set(sourceDays.map(d => String(d.date).slice(0, 10)))].sort();
    const series: { date: string; mentions: number }[] = [];
    if (allDates.length) {
      const map = new Map(mine.map(d => [String(d.date).slice(0, 10), num(d.mentions)]));
      const cur = new Date(allDates[0] + 'T00:00:00');
      const last = new Date(allDates[allDates.length - 1] + 'T00:00:00');
      let guard = 0;
      while (cur <= last && guard++ < 800) {
        const k = ymd(cur);
        series.push({ date: k, mentions: map.get(k) ?? 0 });
        cur.setDate(cur.getDate() + 1);
      }
    }
    let peak: { date: string; v: number } | null = null;
    series.forEach(d => { if (!peak || d.mentions > peak.v) peak = { date: d.date, v: d.mentions }; });
    const engagement = ex ? num(ex.likes) + num(ex.comments) + num(ex.shares) : 0;
    const scored = picked.positive + picked.neutral + picked.negative;
    return { ex, series, peak: peak as { date: string; v: number } | null, engagement, scored };
  }, [picked, extra, sourceDays]);

  const insights = useMemo(() => {
    if (!picked || !detail) return [] as string[];
    const out: string[] = [];
    const label = picked.label;
    if (totalReach > 0 && picked.reach > 0) out.push(`${label} delivers ${pctLabel((picked.reach / totalReach) * 100)} of all estimated reach.`);
    if (picked.mentions > 0 && picked.reach > 0) out.push(`Each ${label} mention reaches about ${fmt(picked.reach / picked.mentions)} people on average.`);
    if (detail.peak && detail.peak.v > 0) out.push(`Busiest day: ${formatDay(detail.peak.date)}, with ${detail.peak.v} mention${detail.peak.v === 1 ? '' : 's'}.`);
    if (detail.engagement > 0 && picked.mentions > 0) out.push(`${fmt(detail.engagement)} likes, comments and shares, about ${fmt(detail.engagement / picked.mentions)} per post.`);
    if (detail.scored > 0) {
      const pos = (picked.positive / detail.scored) * 100;
      const neg = (picked.negative / detail.scored) * 100;
      if (neg === 0) out.push('No negative mentions here.');
      else if (pos > neg * 2) out.push('Sentiment leans clearly positive.');
      else if (neg > pos) out.push('Negative outweighs positive here, so it is worth reading.');
    }
    return out.slice(0, 4);
  }, [picked, detail, totalReach]);

  if (!slices.length) return null;

  const summary = slices.map(s => `${s.label} ${pctLabel(s.frac * 100)}`).join(', ');

  return (
    <Fragment>
      <div
        className="section-card border p-5 overflow-hidden h-full flex flex-col"
        style={{ background: 'linear-gradient(160deg, hsl(255 70% 55% / 0.05), transparent 55%)' }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Where mentions come from</h3>
          <p className="text-[11px] text-muted-foreground">Hover to explore, click for the story</p>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="w-56 h-56 xl:w-60 xl:h-60 shrink-0 select-none"
            role="img"
            aria-label={`Share of mentions by channel: ${summary}`}
            onMouseLeave={() => setHover(null)}
          >
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="hsl(0 0% 94%)" strokeWidth={STROKE} />
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              {slices.map(s => {
                const isActive = activeKey === s.source;
                const dim = hoverGroup && activeKey == null ? !inGroup(s.source) : activeKey != null && !isActive;
                return (
                  <circle
                    key={s.source}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isActive ? STROKE + 10 : STROKE}
                    strokeDasharray={`${drawn || reduced ? s.len : 0} ${CIRC}`}
                    strokeDashoffset={-s.start}
                    opacity={dim ? 0.3 : 1}
                    style={{
                      cursor: 'pointer',
                      transition: reduced ? undefined : 'stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1), stroke-width 160ms ease, opacity 160ms ease',
                      filter: isActive ? `drop-shadow(0 2px 6px ${withAlpha(s.color, 0.5)})` : undefined,
                    }}
                    onMouseEnter={() => setHover(s.source)}
                    onClick={() => setSelected(prev => (prev === s.source ? null : s.source))}
                  />
                );
              })}
            </g>
            <g style={{ pointerEvents: 'none' }} textAnchor="middle">
              <text x={CENTER} y={CENTER - 16} style={{ fontSize: 11, fill: 'hsl(0 0% 45%)' }}>
                {active ? active.label : groupCenter ? groupCenter.label : 'All channels'}
              </text>
              <text x={CENTER} y={CENTER + 14} className="font-display" style={{ fontSize: 32, fontWeight: 700, fill: active ? active.color : groupCenter ? groupCenter.color : 'hsl(0 0% 12%)' }}>
                {active ? pctLabel(active.frac * 100) : groupCenter ? pctLabel(total ? (groupCenter.n / total) * 100 : 0) : fmt(total)}
              </text>
              <text x={CENTER} y={CENTER + 34} style={{ fontSize: 11, fill: 'hsl(0 0% 45%)' }}>
                {active ? `${fmt(active.mentions)} mentions` : groupCenter ? `${fmt(groupCenter.n)} mentions` : 'mentions'}
              </text>
            </g>
          </svg>

          <ul className="w-full space-y-1.5" onMouseLeave={() => setHover(null)}>
            {slices.map(s => {
              const isActive = activeKey === s.source;
              const isSelected = selected === s.source;
              return (
                <li key={s.source}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onMouseEnter={() => setHover(s.source)}
                    onFocus={() => setHover(s.source)}
                    onBlur={() => setHover(null)}
                    onClick={() => setSelected(prev => (prev === s.source ? null : s.source))}
                    className="relative w-full flex items-center gap-3 px-2.5 py-2.5 text-sm text-left overflow-hidden transition-colors focus:outline-none focus-visible:ring-2"
                    style={{
                      background: isActive ? withAlpha(s.color, 0.12) : undefined,
                      boxShadow: isSelected ? `inset 3px 0 0 ${s.color}` : undefined,
                      opacity: hoverGroup && !inGroup(s.source) ? 0.45 : 1,
                      ['--tw-ring-color' as any]: s.color,
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: drawn || reduced ? `${s.frac * 100}%` : '0%',
                        background: withAlpha(s.color, 0.09),
                        transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                    <span className="relative w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} aria-hidden />
                    <span className="relative flex-1 min-w-0 truncate font-medium">{s.label}</span>
                    <span className="relative tabular-nums text-muted-foreground">{fmt(s.mentions)}</span>
                    <span className="relative tabular-nums font-bold w-12 text-right">{pctLabel(s.frac * 100)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-2">Social vs non-social</p>
          <div className="flex h-8 w-full overflow-hidden bg-muted" onMouseLeave={() => setHoverGroup(null)}>
            {([
              { key: 'social' as const, label: 'Social', n: socialMentions, color: SOCIAL_COLOR },
              { key: 'nonsocial' as const, label: 'Non-social', n: nonSocialMentions, color: NONSOCIAL_COLOR },
            ]).map(g => {
              if (g.n <= 0) return null;
              const share = total ? (g.n / total) * 100 : 0;
              return (
                <button
                  key={g.key}
                  type="button"
                  aria-label={`${g.label}: ${fmt(g.n)} mentions, ${pctLabel(share)} of the total`}
                  onMouseEnter={() => setHoverGroup(g.key)}
                  onFocus={() => setHoverGroup(g.key)}
                  onBlur={() => setHoverGroup(null)}
                  className="h-full flex items-center justify-center text-[11px] font-bold text-white whitespace-nowrap overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  style={{
                    width: drawn || reduced ? `${share}%` : '0%',
                    background: g.color,
                    filter: hoverGroup === g.key ? 'brightness(1.12) saturate(1.1)' : undefined,
                    transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1), filter 160ms ease',
                  }}
                >
                  {share >= 22 ? `${pctLabel(share)} ${g.label}` : pctLabel(share)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {fmt(socialMentions)} mentions on social platforms and {fmt(nonSocialMentions)} on news, Reddit, blogs and podcasts. Hover a side to see its channels in the donut.
          </p>
        </div>
      </div>

      {picked && detail && (
        <div
          role="region"
          aria-label={`${picked.label} details`}
          className="col-span-full border animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            borderColor: withAlpha(picked.color, 0.35),
            borderTop: `3px solid ${picked.color}`,
            background: `linear-gradient(180deg, ${withAlpha(picked.color, 0.07)}, transparent 60%)`,
          }}
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: picked.color }}>{picked.label}</p>
                <p className="font-display text-3xl font-bold tabular-nums leading-tight">
                  {pctLabel(picked.frac * 100)} <span className="text-base font-normal text-muted-foreground">of all mentions, {fmt(picked.mentions)} in total</span>
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 shrink-0">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-5 mt-5">
              <div className="lg:col-span-3">
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-2">Daily mentions</p>
                {detail.series.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={detail.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="source-mix-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={picked.color} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={picked.color} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d)} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} minTickGap={28} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip
                        labelFormatter={(d: string) => formatDay(d, true)}
                        formatter={(v: number) => [v, 'Mentions']}
                        contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, fontSize: 11 }}
                        labelStyle={{ color: 'white' }}
                        itemStyle={{ color: 'white' }}
                        cursor={{ stroke: picked.color, strokeOpacity: 0.4 }}
                      />
                      <Area type="monotone" dataKey="mentions" stroke={picked.color} strokeWidth={2.25} fill="url(#source-mix-grad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: picked.color }} isAnimationActive={!reduced} animationDuration={700} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-10 text-center">Not enough days of data yet to draw a trend.</p>
                )}
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimated reach</p>
                    <p className="text-lg font-bold tabular-nums">{picked.reach ? fmt(picked.reach) : 'n/a'}</p>
                  </div>
                  {detail.ex && num(detail.ex.ave) > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ad value (AVE)</p>
                      <p className="text-lg font-bold tabular-nums">${fmt(num(detail.ex.ave))}</p>
                    </div>
                  )}
                  {detail.engagement > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interactions</p>
                      <p className="text-lg font-bold tabular-nums">{fmt(detail.engagement)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-2">How people feel</p>
                  {detail.scored > 0 ? (
                    <>
                      <div
                        className="flex h-2 w-full overflow-hidden bg-muted"
                        role="img"
                        aria-label={`${Math.round((picked.positive / detail.scored) * 100)}% positive, ${Math.round((picked.negative / detail.scored) * 100)}% negative`}
                      >
                        <div style={{ width: `${(picked.positive / detail.scored) * 100}%`, backgroundColor: 'hsl(152 55% 40%)' }} />
                        <div style={{ width: `${(picked.neutral / detail.scored) * 100}%`, backgroundColor: 'hsl(0 0% 80%)' }} />
                        <div style={{ width: `${(picked.negative / detail.scored) * 100}%`, backgroundColor: 'hsl(0 70% 50%)' }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                        <span className="font-semibold" style={{ color: 'hsl(152 55% 32%)' }}>{picked.positive.toLocaleString('en-US')} positive</span>
                        {' · '}{picked.neutral.toLocaleString('en-US')} neutral{' · '}
                        <span className="font-semibold" style={{ color: 'hsl(0 70% 42%)' }}>{picked.negative.toLocaleString('en-US')} negative</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sentiment scores for this channel yet.</p>
                  )}
                </div>
              </div>
            </div>

            {insights.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {insights.map(t => (
                  <li key={t} className="text-xs px-3 py-1.5" style={{ background: withAlpha(picked.color, 0.1), color: 'hsl(0 0% 20%)' }}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default SocialListeningSourceMix;