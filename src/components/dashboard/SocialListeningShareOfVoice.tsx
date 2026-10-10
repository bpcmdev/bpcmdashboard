/* eslint-disable @typescript-eslint/no-explicit-any -- listening_* RPCs are not in the generated Supabase types yet */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Crown, Swords, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { Chips, CountUp, DeltaChip, SubLabel, Tile, arr, fmt, num, useEscape, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Social Listening: share of voice against the competitor set tracked in Brand24.
 * Switch between share of mentions, reach and positive conversation. The 100% bar, ranked list and
 * share-over-time chart are linked: hover any brand to light it up everywhere, select one to open a
 * head-to-head against the client. Comparisons start on the first day every brand has data.
 * RPC: listening_sov
 * ---------------------------------------------------------------------------------------------- */

interface BrandRow {
  brand: string;
  project_id: number;
  is_own: boolean;
  mentions: number;
  reach: number;
  positive: number;
  negative: number;
  social_mentions: number;
  non_social_mentions: number;
  prior_mentions: number | null;
  has_data: boolean;
  by_source: { source: string; mentions: number }[];
}

interface SovData {
  compared_from: string | null;
  to: string | null;
  requested_from: string | null;
  prior_available: boolean;
  paused: string[];
  brands: BrandRow[];
  daily: { date: string; brand: string; mentions: number }[];
}

type Metric = 'mentions' | 'reach' | 'positive';

const METRICS: { key: Metric; label: string; noun: string }[] = [
  { key: 'mentions', label: 'Mentions', noun: 'mentions' },
  { key: 'reach', label: 'Reach', noun: 'estimated reach' },
  { key: 'positive', label: 'Positive', noun: 'positive mentions' },
];

const OWN_COLOR = 'hsl(258 68% 52%)';
const PALETTE = ['hsl(174 58% 34%)', 'hsl(36 88% 46%)', 'hsl(210 72% 46%)', 'hsl(8 72% 54%)', 'hsl(140 45% 38%)', 'hsl(322 55% 50%)', 'hsl(220 14% 48%)'];

const SOURCE_LABEL: Record<string, string> = {
  tiktok: 'TikTok', twitter: 'X', x: 'X', youtube: 'YouTube', reddit: 'Reddit', instagram: 'Instagram',
  facebook: 'Facebook', news: 'News', other: 'Blogs, web & podcasts',
};
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Other');

const formatDay = (d: string | null, withYear = false): string => {
  if (!d) return '';
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
};

const pctText = (p: number) => (p > 0 && p < 1 ? `${p.toFixed(1)}%` : `${p.toFixed(p >= 10 ? 0 : 1)}%`);

const valueOf = (b: BrandRow, m: Metric) => (m === 'mentions' ? num(b.mentions) : m === 'reach' ? num(b.reach) : num(b.positive));

const SocialListeningShareOfVoice = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const { isAdmin } = useAdmin();
  const reduced = usePrefersReducedMotion();
  const [data, setData] = useState<SovData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [metric, setMetric] = useState<Metric>('mentions');
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

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
      setLoading(true);
      setError(false);
      const { data: d, error: err } = await supabase.rpc('listening_sov' as any, { p_client_id: activeClientId, ...range });
      if (cancelled) return;
      if (err) {
        console.error('listening_sov failed:', err);
        setError(true);
        setLoading(false);
        return;
      }
      setData((d ?? null) as SovData | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, range, refreshKey]);

  const brands = useMemo(() => arr<BrandRow>(data?.brands).filter(b => b.has_data), [data]);
  const pending = useMemo(() => arr<BrandRow>(data?.brands).filter(b => !b.has_data).map(b => b.brand), [data]);

  // Stable colours: the client gets its own colour, competitors are coloured alphabetically.
  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    const comps = arr<BrandRow>(data?.brands).filter(b => !b.is_own).map(b => b.brand).sort((a, b) => a.localeCompare(b));
    comps.forEach((b, i) => map.set(b, PALETTE[i % PALETTE.length]));
    arr<BrandRow>(data?.brands).filter(b => b.is_own).forEach(b => map.set(b.brand, OWN_COLOR));
    return (b: string) => map.get(b) ?? 'hsl(0 0% 60%)';
  }, [data]);

  const total = brands.reduce((s, b) => s + valueOf(b, metric), 0);
  const ranked = useMemo(
    () => [...brands].map(b => ({ ...b, value: valueOf(b, metric), share: total ? (valueOf(b, metric) / total) * 100 : 0 })).sort((a, b) => b.value - a.value),
    [brands, metric, total],
  );
  const own = ranked.find(b => b.is_own) ?? null;
  const ownRank = own ? ranked.findIndex(b => b.is_own) + 1 : 0;
  const leader = ranked[0] ?? null;

  // Share-of-mentions change against the prior period (only when every brand has prior data).
  const priorShare = useMemo(() => {
    if (!data?.prior_available) return null;
    const priorTotal = brands.reduce((s, b) => s + num(b.prior_mentions), 0);
    if (!priorTotal) return null;
    const map = new Map<string, number>();
    brands.forEach(b => map.set(b.brand, (num(b.prior_mentions) / priorTotal) * 100));
    return map;
  }, [data, brands]);
  const mentionTotal = brands.reduce((s, b) => s + num(b.mentions), 0);
  const shareDelta = (b: BrandRow): number | null => {
    if (!priorShare || !mentionTotal || metric !== 'mentions') return null;
    const p = priorShare.get(b.brand);
    return p == null ? null : (num(b.mentions) / mentionTotal) * 100 - p;
  };

  // Share over time (always share of mentions; daily for short ranges, weekly otherwise).
  const trend = useMemo(() => {
    const rows = arr<{ date: string; brand: string; mentions: number }>(data?.daily);
    if (!rows.length) return { data: [] as Record<string, any>[], bucket: 'day' as const };
    const dates = [...new Set(rows.map(r => String(r.date).slice(0, 10)))].sort();
    const bucket: 'day' | 'week' = dates.length > 21 ? 'week' : 'day';
    const keyOf = (d: string) => {
      if (bucket === 'day') return d;
      const x = new Date(d + 'T00:00:00');
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    const live = new Set(brands.map(b => b.brand));
    const byKey = new Map<string, Record<string, any>>();
    rows.forEach(r => {
      if (!live.has(r.brand)) return;
      const k = keyOf(String(r.date).slice(0, 10));
      const row = byKey.get(k) ?? { date: k };
      row[r.brand] = num(row[r.brand]) + num(r.mentions);
      byKey.set(k, row);
    });
    const out = [...byKey.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    out.forEach(row => brands.forEach(b => { if (row[b.brand] == null) row[b.brand] = 0; }));
    return { data: out, bucket };
  }, [data, brands]);

  const focus = hover ?? selected;
  const toggleSelect = (b: string) => setSelected(prev => (prev === b ? null : b));

  if (loading && !data) {
    return <div className="section-card border p-6"><div className="shimmer h-3 w-40 mb-4" /><div className="shimmer h-10 w-full mb-4" /><div className="shimmer h-40 w-full" /></div>;
  }
  if (error) return <p className="text-sm text-destructive">Share of voice could not be loaded. Refresh the page to try again.</p>;
  if (!data || brands.length < 2 || !own) {
    if (!data || arr(data.brands).length < 2) return null;
    return (
      <div className="section-card border p-6">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Share of voice</h3>
        <p className="text-sm text-muted-foreground mt-3">
          Competitor data is still being collected{pending.length ? ` for ${pending.join(', ')}` : ''}. Share of voice appears after the next listening sync.
        </p>
      </div>
    );
  }

  const meta = METRICS.find(m => m.key === metric)!;
  const comps = ranked.filter(b => !b.is_own).map(b => b.brand);
  const mentionShareOwn = mentionTotal ? (num(own.mentions) / mentionTotal) * 100 : 0;
  const posTotal = brands.reduce((s, b) => s + num(b.positive), 0);
  const posShareOwn = posTotal ? (num(own.positive) / posTotal) * 100 : 0;

  const headline: string[] = [];
  if (leader && !leader.is_own) headline.push(`${leader.brand} leads with ${pctText(leader.share)}.`);
  if (own && leader && !leader.is_own) headline.push(`${own.brand} sits ${(leader.share - own.share).toFixed(1)} pts behind.`);
  if (own && ownRank === 1) headline.push(`${own.brand} leads the set.`);

  const insights: string[] = [];
  if (mentionShareOwn > 0 && posShareOwn > 0 && Math.abs(posShareOwn - mentionShareOwn) >= 1) {
    insights.push(posShareOwn > mentionShareOwn
      ? `${own.brand} punches above its weight: ${pctText(posShareOwn)} of positive conversation from ${pctText(mentionShareOwn)} of mentions.`
      : `${own.brand} holds ${pctText(mentionShareOwn)} of mentions but only ${pctText(posShareOwn)} of the positive conversation.`);
  }
  const ownSrcTotal = own.by_source.reduce((s, r) => s + num(r.mentions), 0);
  const setSrc = new Map<string, number>();
  brands.forEach(b => b.by_source.forEach(s => setSrc.set(s.source, (setSrc.get(s.source) ?? 0) + num(s.mentions))));
  const winLose = [...setSrc.entries()]
    .filter(([, t]) => t >= 20)
    .map(([src, t]) => ({ src, share: ((own.by_source.find(r => r.source === src)?.mentions ?? 0) / t) * 100 }))
    .sort((a, b) => b.share - a.share);
  if (winLose.length >= 2 && ownSrcTotal > 0) {
    insights.push(`Strongest channel for ${own.brand}: ${sourceLabel(winLose[0].src)}, with ${pctText(winLose[0].share)} of the set's conversation there.`);
    const weak = winLose[winLose.length - 1];
    if (weak.share < winLose[0].share) insights.push(`Biggest gap: ${sourceLabel(weak.src)}, where ${own.brand} holds ${pctText(weak.share)}.`);
  }
  const ownDelta = shareDelta(own);
  if (ownDelta != null && Math.abs(ownDelta) >= 0.5) insights.push(`Share of mentions is ${ownDelta > 0 ? 'up' : 'down'} ${Math.abs(ownDelta).toFixed(1)} pts on the prior period.`);

  const picked = selected ? ranked.find(b => b.brand === selected) ?? null : null;

  return (
    <div className="section-card border overflow-hidden">
      <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${[OWN_COLOR, ...comps.map(colorOf)].join(', ')})` }} />
      <div className="p-5 md:p-6">
        {/* ---------- header ---------- */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground flex items-center gap-2">
              <Swords className="w-3.5 h-3.5" aria-hidden /> Share of voice
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              {own.brand} against {comps.join(', ')}. Compared from {formatDay(data.compared_from, true)}
              {data.requested_from && data.compared_from && data.compared_from > data.requested_from ? ', the first day every brand has data' : ''}.
            </p>
          </div>
          <div role="group" aria-label="Measure share by" className="flex">
            {METRICS.map(m => (
              <button
                key={m.key}
                type="button"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2',
                  metric === m.key ? 'text-white relative z-10' : 'border-border text-muted-foreground hover:text-foreground',
                )}
                style={metric === m.key ? { background: OWN_COLOR, borderColor: OWN_COLOR } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- hero numbers ---------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="col-span-2 md:col-span-1">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{own.brand} share</p>
            <p className="font-display text-5xl font-bold tabular-nums leading-none mt-1" style={{ color: OWN_COLOR }}>
              <CountUp value={own.share} format={n => pctText(n)} />
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">of {meta.noun}</span>
              {metric === 'mentions' && <DeltaChip pct={ownDelta} suffix="pts" title="Change in share against the prior period" />}
            </div>
          </div>
          <Tile label="Rank" value={<span className="flex items-center gap-1.5">#{ownRank} <span className="text-sm font-normal text-muted-foreground">of {ranked.length}</span>{ownRank === 1 && <Crown className="w-4 h-4" style={{ color: OWN_COLOR }} aria-hidden />}</span>} />
          <Tile
            label={leader && !leader.is_own ? 'Gap to the leader' : 'Lead over #2'}
            value={leader && !leader.is_own ? `${(leader.share - own.share).toFixed(1)} pts` : ranked[1] ? `${(own.share - ranked[1].share).toFixed(1)} pts` : '-'}
            hint={leader && !leader.is_own ? leader.brand : ranked[1]?.brand}
          />
          <Tile label={`${own.brand} ${meta.noun}`} value={fmt(valueOf(own, metric))} hint={`of ${fmt(total)} across the set`} />
        </div>

        {/* ---------- 100% share bar ---------- */}
        <div className="mt-6" onMouseLeave={() => setHover(null)}>
          <div className="flex h-11 w-full overflow-hidden">
            {ranked.map(b => {
              const dim = focus != null && focus !== b.brand;
              return (
                <button
                  key={b.brand}
                  type="button"
                  aria-label={`${b.brand}: ${pctText(b.share)} of ${meta.noun}. Open head-to-head.`}
                  onMouseEnter={() => setHover(b.brand)}
                  onFocus={() => setHover(b.brand)}
                  onBlur={() => setHover(null)}
                  onClick={() => toggleSelect(b.brand)}
                  className="relative h-full flex items-center justify-center text-[11px] font-bold text-white overflow-hidden whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  style={{
                    width: drawn || reduced ? `${b.share}%` : '0%',
                    minWidth: drawn && b.share > 0 ? 3 : 0,
                    background: b.is_own
                      ? `repeating-linear-gradient(135deg, ${OWN_COLOR}, ${OWN_COLOR} 10px, ${withAlpha(OWN_COLOR, 0.85)} 10px, ${withAlpha(OWN_COLOR, 0.85)} 20px)`
                      : colorOf(b.brand),
                    opacity: dim ? 0.3 : 1,
                    boxShadow: b.is_own ? 'inset 0 0 0 2px rgba(255,255,255,0.6)' : undefined,
                    transition: reduced ? undefined : 'width 1000ms cubic-bezier(0.22,1,0.36,1), opacity 160ms ease',
                  }}
                >
                  {b.share >= 8 ? (b.share >= 16 ? `${b.brand} ${pctText(b.share)}` : pctText(b.share)) : ''}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2 min-h-[1.25rem]" aria-live="polite">
            {focus ? (() => {
              const b = ranked.find(r => r.brand === focus);
              if (!b) return null;
              const diff = b.share - own.share;
              return (
                <span>
                  <span className="font-bold" style={{ color: colorOf(b.brand) }}>{b.brand}</span>
                  {`: ${pctText(b.share)} of ${meta.noun} (${fmt(b.value)})`}
                  {!b.is_own ? `, ${Math.abs(diff).toFixed(1)} pts ${diff > 0 ? 'ahead of' : 'behind'} ${own.brand}.` : '.'}
                </span>
              );
            })() : <span className="text-muted-foreground">{headline.join(' ')} Hover a brand to compare, select it for a head-to-head.</span>}
          </p>
        </div>

        {/* ---------- ranked list + share over time ---------- */}
        <div className="grid gap-6 lg:grid-cols-5 mt-5">
          <div className="lg:col-span-2">
            <SubLabel>Ranking by {meta.noun}</SubLabel>
            <ul className="space-y-1" onMouseLeave={() => setHover(null)}>
              {ranked.map((b, i) => {
                const on = focus === b.brand;
                const d = shareDelta(b);
                return (
                  <li key={b.brand}>
                    <button
                      type="button"
                      aria-pressed={selected === b.brand}
                      onMouseEnter={() => setHover(b.brand)}
                      onFocus={() => setHover(b.brand)}
                      onBlur={() => setHover(null)}
                      onClick={() => toggleSelect(b.brand)}
                      className="relative w-full flex items-center gap-2.5 px-2.5 py-2 text-left overflow-hidden transition-colors focus:outline-none focus-visible:ring-2"
                      style={{
                        background: on ? withAlpha(colorOf(b.brand), 0.1) : b.is_own ? withAlpha(OWN_COLOR, 0.05) : undefined,
                        boxShadow: selected === b.brand ? `inset 3px 0 0 ${colorOf(b.brand)}` : undefined,
                        opacity: focus != null && !on ? 0.6 : 1,
                      }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: drawn || reduced ? `${ranked[0].share ? (b.share / ranked[0].share) * 100 : 0}%` : '0%',
                          background: withAlpha(colorOf(b.brand), 0.12),
                          transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22,1,0.36,1)',
                        }}
                      />
                      <span className="relative w-5 text-right text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
                      <span className="relative w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(b.brand) }} aria-hidden />
                      <span className={cn('relative flex-1 min-w-0 truncate text-sm', b.is_own && 'font-bold')}>{b.brand}</span>
                      {d != null && <span className="relative"><DeltaChip pct={d} suffix="pts" /></span>}
                      <span className="relative tabular-nums text-sm font-bold w-12 text-right">{pctText(b.share)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <SubLabel>Share of mentions over time{trend.bucket === 'week' ? ' (weekly)' : ''}</SubLabel>
            {trend.data.length >= 2 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trend.data} stackOffset="expand" margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d)} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, fontSize: 11 }}
                    labelStyle={{ color: 'white' }}
                    itemStyle={{ color: 'white' }}
                    labelFormatter={(d: string) => (trend.bucket === 'week' ? `Week of ${formatDay(d, true)}` : formatDay(d, true))}
                    formatter={(v: number, name: string, item: any) => {
                      const row = item?.payload ?? {};
                      const sum = brands.reduce((s, b) => s + num(row[b.brand]), 0);
                      return [`${sum ? pctText((num(v) / sum) * 100) : '0%'} (${fmt(num(v))})`, name];
                    }}
                  />
                  {[...ranked].reverse().map(b => (
                    <Area
                      key={b.brand}
                      type="monotone"
                      dataKey={b.brand}
                      stackId="sov"
                      stroke={colorOf(b.brand)}
                      strokeWidth={b.is_own ? 2 : 1}
                      fill={colorOf(b.brand)}
                      fillOpacity={focus == null ? (b.is_own ? 0.85 : 0.55) : focus === b.brand ? 0.9 : 0.12}
                      isAnimationActive={!reduced}
                      animationDuration={800}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Not enough days of shared data yet to draw a trend.</p>
            )}
          </div>
        </div>

        {/* ---------- head-to-head ---------- */}
        {picked && (
          <HeadToHead own={own} other={picked} ownColor={OWN_COLOR} otherColor={colorOf(picked.brand)} brands={brands} onClose={close} />
        )}

        <Chips items={insights.slice(0, 4)} color={OWN_COLOR} />

        <p className="text-[11px] text-muted-foreground mt-4">
          Counts every public mention Brand24 finds for each brand&apos;s keywords, across social, news, forums and the web.
          {pending.length ? ` Still collecting: ${pending.join(', ')}.` : ''}
          {isAdmin && arr<string>(data.paused).length ? ` Paused until their keywords are tightened: ${arr<string>(data.paused).join(', ')}.` : ''}
        </p>
      </div>
    </div>
  );
};

function HeadToHead({ own, other, ownColor, otherColor, brands, onClose }: {
  own: BrandRow; other: BrandRow; ownColor: string; otherColor: string; brands: BrandRow[]; onClose: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const isSelf = other.is_own;
  // Comparing the client with itself shows it against the average competitor instead.
  const rivals = brands.filter(b => !b.is_own);
  const avg = (f: (b: BrandRow) => number) => (rivals.length ? rivals.reduce((s, b) => s + f(b), 0) / rivals.length : 0);
  const them = isSelf
    ? {
        brand: 'Average competitor',
        mentions: avg(b => num(b.mentions)), reach: avg(b => num(b.reach)), positive: avg(b => num(b.positive)), negative: avg(b => num(b.negative)),
        social_mentions: avg(b => num(b.social_mentions)),
        by_source: (() => {
          const m = new Map<string, number>();
          rivals.forEach(b => b.by_source.forEach(s => m.set(s.source, (m.get(s.source) ?? 0) + num(s.mentions) / rivals.length)));
          return [...m.entries()].map(([source, mentions]) => ({ source, mentions }));
        })(),
      }
    : other;
  const themColor = isSelf ? 'hsl(220 14% 48%)' : otherColor;

  const rate = (n: number, d: number) => (d ? (n / d) * 100 : 0);
  const ownPos = rate(num(own.positive), num(own.mentions));
  const themPos = rate(num(them.positive), num(them.mentions));
  const ownNeg = rate(num(own.negative), num(own.mentions));
  const themNeg = rate(num(them.negative), num(them.mentions));
  const ownSocial = rate(num(own.social_mentions), num(own.mentions));
  const themSocial = rate(num(them.social_mentions), num(them.mentions));
  const ownRpm = num(own.mentions) ? num(own.reach) / num(own.mentions) : 0;
  const themRpm = num(them.mentions) ? num(them.reach) / num(them.mentions) : 0;

  const sources = [...new Set([...own.by_source.map(s => s.source), ...them.by_source.map(s => s.source)])];
  const ownSrcTotal = own.by_source.reduce((s, r) => s + num(r.mentions), 0);
  const themSrcTotal = them.by_source.reduce((s, r) => s + num(r.mentions), 0);
  const mix = sources
    .map(src => ({
      src,
      own: rate(num(own.by_source.find(s => s.source === src)?.mentions), ownSrcTotal),
      them: rate(num(them.by_source.find(s => s.source === src)?.mentions), themSrcTotal),
    }))
    .filter(r => r.own >= 1 || r.them >= 1)
    .sort((a, b) => b.own + b.them - (a.own + a.them))
    .slice(0, 7);

  const insights: string[] = [];
  const ratio = num(own.mentions) ? num(them.mentions) / num(own.mentions) : 0;
  if (ratio > 0) insights.push(ratio >= 1 ? `${them.brand} gets ${ratio.toFixed(1)}x the mentions of ${own.brand}.` : `${own.brand} gets ${(1 / ratio).toFixed(1)}x the mentions of ${them.brand}.`);
  if (ownPos && themPos && Math.abs(ownPos - themPos) >= 2) insights.push(`Positive rate: ${own.brand} ${ownPos.toFixed(0)}% against ${themPos.toFixed(0)}% for ${them.brand}.`);
  const swing = [...mix].sort((a, b) => Math.abs(b.own - b.them) - Math.abs(a.own - a.them))[0];
  if (swing && Math.abs(swing.own - swing.them) >= 5) insights.push(`${sourceLabel(swing.src)} is ${swing.own.toFixed(0)}% of ${own.brand}'s conversation against ${swing.them.toFixed(0)}% for ${them.brand}.`);
  if (ownRpm && themRpm && Math.max(ownRpm, themRpm) / Math.min(ownRpm, themRpm) >= 1.3) insights.push(`Each ${ownRpm > themRpm ? own.brand : them.brand} mention reaches more people: ${fmt(Math.max(ownRpm, themRpm))} against ${fmt(Math.min(ownRpm, themRpm))}.`);

  const Row = ({ label, a, b, format }: { label: string; a: number; b: number; format: (n: number) => string }) => {
    const max = Math.max(a, b, 0.0001);
    return (
      <div>
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">{label}</p>
        {[{ v: a, c: ownColor, n: own.brand }, { v: b, c: themColor, n: them.brand }].map(x => (
          <div key={x.n} className="flex items-center gap-2 text-xs mb-1">
            <span className="w-24 truncate text-muted-foreground">{x.n}</span>
            <span className="flex-1 h-2 bg-black/[0.06]">
              <span className="block h-full" style={{ width: `${(x.v / max) * 100}%`, background: x.c, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
            </span>
            <span className="w-14 text-right tabular-nums font-semibold">{format(x.v)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      role="region"
      aria-label={`${own.brand} against ${them.brand}`}
      className="mt-6 border animate-in fade-in slide-in-from-top-2 duration-300"
      style={{ borderLeftColor: withAlpha(themColor, 0.35), borderRightColor: withAlpha(themColor, 0.35), borderBottomColor: withAlpha(themColor, 0.35), borderTop: `3px solid ${themColor}`, background: `linear-gradient(180deg, ${withAlpha(themColor, 0.06)}, transparent 60%)` }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="font-display text-2xl font-bold leading-tight">
            <span style={{ color: ownColor }}>{own.brand}</span>
            <span className="text-muted-foreground font-normal text-base mx-2">vs</span>
            <span style={{ color: themColor }}>{them.brand}</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Close head-to-head" className="p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mt-4">
          <div className="space-y-3">
            <Row label="Mentions" a={num(own.mentions)} b={num(them.mentions)} format={fmt} />
            <Row label="Estimated reach" a={num(own.reach)} b={num(them.reach)} format={fmt} />
            <Row label="Positive rate" a={ownPos} b={themPos} format={n => `${n.toFixed(0)}%`} />
            <Row label="Negative rate" a={ownNeg} b={themNeg} format={n => `${n.toFixed(1)}%`} />
            <Row label="Share on social platforms" a={ownSocial} b={themSocial} format={n => `${n.toFixed(0)}%`} />
          </div>
          <div>
            <SubLabel>Where the conversation happens</SubLabel>
            {mix.length ? (
              <ul className="space-y-2">
                {mix.map(r => (
                  <li key={r.src} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{sourceLabel(r.src)}</span>
                    <span className="space-y-0.5">
                      {[{ v: r.own, c: ownColor }, { v: r.them, c: themColor }].map((x, i) => (
                        <span key={i} className="flex items-center gap-2">
                          <span className="flex-1 h-1.5 bg-black/[0.06]">
                            <span className="block h-full" style={{ width: `${Math.min(100, x.v)}%`, background: x.c, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
                          </span>
                          <span className="w-9 text-right tabular-nums">{x.v.toFixed(0)}%</span>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No channel breakdown yet.</p>}
            <p className="text-[11px] text-muted-foreground mt-2">Each brand&apos;s mentions split by channel. Top bar {own.brand}, bottom bar {them.brand}.</p>
          </div>
        </div>

        <Chips items={insights.slice(0, 4)} color={themColor} />
      </div>
    </div>
  );
}

export default SocialListeningShareOfVoice;