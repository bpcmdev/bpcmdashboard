/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------------------------------
 * Social Listening — "Sentiment by source".
 * Hand-built stacked bars (no chart-library tooltip): a Share / Count switch, hover read-outs on each
 * segment, a net-sentiment score per channel, and an inline detail panel with a daily positive vs
 * negative trend. RPC: listening_overview_series (source_days). Channel totals arrive from the parent.
 * ---------------------------------------------------------------------------------------------- */

interface SourceRow { source: string; mentions: number; positive: number; negative: number; neutral: number; reach: number }
interface SourceDay { date: string; source: string; mentions: number; positive: number; negative: number }

type Kind = 'pos' | 'neu' | 'neg';

const POS = 'hsl(152 58% 38%)';
const NEU = 'hsl(0 0% 80%)';
const NEG = 'hsl(0 72% 50%)';

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

const withAlpha = (c: string, a: number) => c.replace(/\)$/, ` / ${a})`);

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function fmt(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}K`;
  return Math.round(v).toLocaleString('en-US');
}

const pct = (p: number) => (p > 0 && p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

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

/** Net sentiment in points: share positive minus share negative, so +40 is clearly warm and -10 is a warning. */
function NetPill({ net, big = false }: { net: number; big?: boolean }) {
  const tone = net > 0 ? { bg: withAlpha(POS, 0.14), fg: 'hsl(152 58% 28%)' } : net < 0 ? { bg: withAlpha(NEG, 0.14), fg: 'hsl(0 72% 40%)' } : { bg: 'hsl(0 0% 92%)', fg: 'hsl(0 0% 35%)' };
  return (
    <span
      className={cn('inline-block font-bold tabular-nums', big ? 'text-3xl font-display px-0' : 'text-xs px-2 py-0.5')}
      style={big ? { color: tone.fg } : { background: tone.bg, color: tone.fg }}
      title="Net sentiment: share of positive mentions minus share of negative mentions, in points"
    >
      {signed(net)}
    </span>
  );
}

/* ============================================================================================== */

const SocialListeningSentiment = ({ sources }: { sources: SourceRow[] }) => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<'share' | 'count'>('share');
  const [hover, setHover] = useState<{ source: string; kind: Kind } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
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
        setSourceDays([]);
        return;
      }
      setSourceDays(arr<SourceDay>((data as any)?.source_days));
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const rows = useMemo(() => {
    return arr<SourceRow>(sources)
      .map(r => {
        const pos = num(r.positive);
        const neg = num(r.negative);
        let neu = num(r.neutral);
        let total = pos + neu + neg;
        if (!total) { neu = num(r.mentions); total = neu; }
        const posPct = total ? (pos / total) * 100 : 0;
        const negPct = total ? (neg / total) * 100 : 0;
        return { source: r.source, ...sourceMeta(r.source), pos, neu, neg, total, posPct, neuPct: total ? (neu / total) * 100 : 0, negPct, net: Math.round(posPct - negPct) };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [sources]);

  const overall = useMemo(() => {
    const pos = rows.reduce((s, r) => s + r.pos, 0);
    const neu = rows.reduce((s, r) => s + r.neu, 0);
    const neg = rows.reduce((s, r) => s + r.neg, 0);
    const total = pos + neu + neg;
    return {
      pos, neu, neg, total,
      posPct: total ? (pos / total) * 100 : 0,
      neuPct: total ? (neu / total) * 100 : 0,
      negPct: total ? (neg / total) * 100 : 0,
      net: total ? Math.round((pos / total) * 100 - (neg / total) * 100) : 0,
    };
  }, [rows]);

  const maxTotal = Math.max(1, ...rows.map(r => r.total));

  const highlights = useMemo(() => {
    const out: string[] = [];
    const solid = rows.filter(r => r.total >= 20);
    if (solid.length > 1) {
      const warm = [...solid].sort((a, b) => b.posPct - a.posPct)[0];
      out.push(`Warmest channel: ${warm.label}, ${pct(warm.posPct)} positive.`);
      const cold = [...solid].filter(r => r.neg > 0).sort((a, b) => b.negPct - a.negPct)[0];
      if (cold) out.push(`Highest share of negative: ${cold.label}, ${pct(cold.negPct)}.`);
    }
    if (rows.length) out.push(`Biggest conversation: ${rows[0].label}, ${fmt(rows[0].total)} mentions.`);
    return out;
  }, [rows]);

  const picked = selected ? rows.find(r => r.source === selected) ?? null : null;

  const detail = useMemo(() => {
    if (!picked) return null;
    const mine = sourceDays.filter(d => d.source === picked.source);
    const allDates = [...new Set(sourceDays.map(d => String(d.date).slice(0, 10)))].sort();
    const series: { date: string; Positive: number; Negative: number }[] = [];
    if (allDates.length) {
      const map = new Map(mine.map(d => [String(d.date).slice(0, 10), d]));
      const cur = new Date(allDates[0] + 'T00:00:00');
      const last = new Date(allDates[allDates.length - 1] + 'T00:00:00');
      let guard = 0;
      while (cur <= last && guard++ < 800) {
        const k = ymd(cur);
        const hit = map.get(k);
        series.push({ date: k, Positive: hit ? num(hit.positive) : 0, Negative: hit ? num(hit.negative) : 0 });
        cur.setDate(cur.getDate() + 1);
      }
    }
    let worst: { date: string; v: number } | null = null;
    series.forEach(d => { if (d.Negative > 0 && (!worst || d.Negative > worst.v)) worst = { date: d.date, v: d.Negative }; });
    return { series, worst: worst as { date: string; v: number } | null };
  }, [picked, sourceDays]);

  const insights = useMemo(() => {
    if (!picked || !detail) return [] as string[];
    const out: string[] = [];
    const opinion = picked.posPct + picked.negPct;
    out.push(`${Math.round(opinion)}% of ${picked.label} mentions carry an opinion. The rest are neutral.`);
    if (picked.neg === 0 && picked.pos > 0) out.push('No negative mentions here.');
    else if (picked.pos > picked.neg) out.push(`Positive outnumbers negative ${(picked.pos / Math.max(1, picked.neg)).toFixed(1)} to 1.`);
    else if (picked.neg > picked.pos) out.push('Negative outweighs positive here, so it is worth reading the mentions.');
    const diff = picked.net - overall.net;
    if (Math.abs(diff) >= 3) out.push(`${Math.abs(diff)} points ${diff > 0 ? 'warmer' : 'cooler'} than the average across channels.`);
    if (detail.worst) out.push(`Most negative day: ${formatDay(detail.worst.date)}, with ${detail.worst.v} negative mention${detail.worst.v === 1 ? '' : 's'}.`);
    return out.slice(0, 4);
  }, [picked, detail, overall.net]);

  if (!rows.length) return null;

  const transition = reduced ? undefined : 'width 800ms cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div
      className="section-card border p-5 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, hsl(152 58% 38% / 0.05), transparent 50%)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Sentiment by source</h3>
        <div role="group" aria-label="Bar scale" className="flex">
          {([['share', 'Share'], ['count', 'Count']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1 text-xs font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2',
                mode === m ? 'bg-foreground text-background border-foreground relative z-10' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- overall read-out ---------- */}
      <div className="mb-5">
        <div className="flex items-end gap-4">
          <div>
            <NetPill net={overall.net} big />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Net sentiment</p>
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div
              className="flex h-3 w-full overflow-hidden bg-muted"
              role="img"
              aria-label={`Overall: ${Math.round(overall.posPct)}% positive, ${Math.round(overall.neuPct)}% neutral, ${Math.round(overall.negPct)}% negative`}
            >
              <div style={{ width: drawn || reduced ? `${overall.posPct}%` : '0%', background: POS, transition }} />
              <div style={{ width: drawn || reduced ? `${overall.neuPct}%` : '0%', background: NEU, transition }} />
              <div style={{ width: drawn || reduced ? `${overall.negPct}%` : '0%', background: NEG, transition }} />
            </div>
            <p className="text-xs mt-1.5 tabular-nums">
              <span className="font-semibold" style={{ color: 'hsl(152 58% 30%)' }}>{pct(overall.posPct)} positive</span>
              <span className="text-muted-foreground"> · {pct(overall.neuPct)} neutral · </span>
              <span className="font-semibold" style={{ color: 'hsl(0 72% 42%)' }}>{pct(overall.negPct)} negative</span>
            </p>
          </div>
        </div>
        {highlights.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {highlights.map(t => (
              <li key={t} className="text-xs px-3 py-1.5" style={{ background: 'hsl(255 70% 55% / 0.07)', color: 'hsl(0 0% 20%)' }}>{t}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- one row per channel ---------- */}
      <ul className="space-y-1.5" onMouseLeave={() => setHover(null)}>
        {rows.map(r => {
          const isSel = selected === r.source;
          const dimmed = hover != null && hover.source !== r.source;
          const rowWidth = mode === 'share' ? 100 : (r.total / maxTotal) * 100;
          const segs: { kind: Kind; n: number; color: string; label: string; share: number }[] = [
            { kind: 'pos', n: r.pos, color: POS, label: 'Positive', share: r.posPct },
            { kind: 'neu', n: r.neu, color: NEU, label: 'Neutral', share: r.neuPct },
            { kind: 'neg', n: r.neg, color: NEG, label: 'Negative', share: r.negPct },
          ];
          let acc = 0;
          const placed = segs.map(sg => {
            const start = acc;
            acc += sg.share;
            return { ...sg, start };
          });
          const hot = hover?.source === r.source ? placed.find(sg => sg.kind === hover.kind && sg.n > 0) ?? null : null;
          const hotLeft = hot ? Math.min(88, Math.max(12, ((hot.start + hot.share / 2) / 100) * rowWidth)) : 0;
          return (
            <li key={r.source}>
              <button
                type="button"
                aria-pressed={isSel}
                aria-label={`${r.label}: ${Math.round(r.posPct)}% positive, ${Math.round(r.neuPct)}% neutral, ${Math.round(r.negPct)}% negative, ${r.total} mentions. Select for details.`}
                onClick={() => setSelected(prev => (prev === r.source ? null : r.source))}
                className="w-full flex items-center gap-3 px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2"
                style={{
                  background: isSel ? withAlpha(r.color, 0.08) : undefined,
                  boxShadow: isSel ? `inset 3px 0 0 ${r.color}` : undefined,
                  opacity: dimmed ? 0.55 : 1,
                  ['--tw-ring-color' as any]: r.color,
                }}
              >
                <span className="flex items-center gap-2 w-28 sm:w-36 shrink-0 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} aria-hidden />
                  <span className="text-sm font-medium truncate">{r.label}</span>
                </span>

                <span className="relative flex-1 min-w-0 h-7 block">
                  <span
                    className="flex h-full overflow-hidden"
                    style={{ width: drawn || reduced ? `${rowWidth}%` : '0%', transition }}
                  >
                    {placed.map(sg => {
                      if (sg.n <= 0) return null;
                      const wide = (sg.share / 100) * rowWidth >= 11;
                      const lit = hover?.source === r.source && hover.kind === sg.kind;
                      return (
                        <span
                          key={sg.kind}
                          className="h-full flex items-center justify-center text-[10px] font-bold transition-[filter]"
                          style={{
                            width: `${sg.share}%`,
                            background: sg.color,
                            color: sg.kind === 'neu' ? 'hsl(0 0% 30%)' : 'white',
                            filter: lit ? 'brightness(1.12) saturate(1.1)' : undefined,
                          }}
                          onMouseEnter={() => setHover({ source: r.source, kind: sg.kind })}
                        >
                          {wide ? pct(sg.share) : ''}
                        </span>
                      );
                    })}
                  </span>
                  {hot && (
                    <span
                      className="absolute bottom-full mb-1.5 z-20 whitespace-nowrap px-2.5 py-1.5 text-[11px] font-normal pointer-events-none"
                      style={{ left: `${hotLeft}%`, transform: 'translateX(-50%)', background: 'hsl(0 0% 9%)', color: 'white' }}
                    >
                      <span className="font-bold">{r.label}</span> · {hot.label}: {hot.n.toLocaleString('en-US')} ({pct(hot.share)})
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-2 shrink-0 w-24 justify-end">
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(r.total)}</span>
                  <NetPill net={r.net} />
                </span>
              </button>

              {isSel && detail && (
                <div
                  role="region"
                  aria-label={`${r.label} sentiment details`}
                  className="mt-1.5 mb-2 border animate-in fade-in slide-in-from-top-1 duration-300"
                  style={{ borderColor: withAlpha(r.color, 0.35), borderLeft: `3px solid ${r.color}`, background: withAlpha(r.color, 0.05) }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-end gap-3">
                        <NetPill net={r.net} big />
                        <p className="text-xs text-muted-foreground pb-1">net sentiment for <span className="font-semibold text-foreground">{r.label}</span></p>
                      </div>
                      <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 shrink-0">
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {[
                        { label: 'Positive', n: r.pos, p: r.posPct, color: 'hsl(152 58% 30%)' },
                        { label: 'Neutral', n: r.neu, p: r.neuPct, color: 'hsl(0 0% 35%)' },
                        { label: 'Negative', n: r.neg, p: r.negPct, color: 'hsl(0 72% 42%)' },
                      ].map(s => (
                        <div key={s.label}>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                          <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.n.toLocaleString('en-US')}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">{pct(s.p)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-1">Daily positive vs negative</p>
                      {detail.series.length >= 2 ? (
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={detail.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d)} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} minTickGap={28} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip
                              labelFormatter={(d: string) => formatDay(d, true)}
                              contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, fontSize: 11 }}
                              labelStyle={{ color: 'white' }}
                              itemStyle={{ color: 'white' }}
                              cursor={{ fill: 'hsl(0 0% 50% / 0.08)' }}
                            />
                            <Bar dataKey="Positive" stackId="d" fill={POS} isAnimationActive={!reduced} animationDuration={600} />
                            <Bar dataKey="Negative" stackId="d" fill={NEG} isAnimationActive={!reduced} animationDuration={600} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground py-6 text-center">Not enough days of data yet to draw a trend.</p>
                      )}
                    </div>

                    {insights.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {insights.map(t => (
                          <li key={t} className="text-xs px-3 py-1.5" style={{ background: withAlpha(r.color, 0.1), color: 'hsl(0 0% 20%)' }}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-muted-foreground mt-4">
        {mode === 'share' ? 'Bars show each channel\u2019s mix of positive, neutral and negative so channels compare fairly.' : 'Bars show how many mentions each channel has, split by sentiment.'}
        {' '}Net sentiment is the positive share minus the negative share, in points.
      </p>
    </div>
  );
};

export default SocialListeningSentiment;