/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, Crown, Newspaper, Share2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Sparkline from './Sparkline';
import {
  Chips, CountUp, DeltaChip, DetailShell, MetricCard, SubLabel, Tile, arr, axisTick, fmt, fmtMoney,
  insertAfterIndex, num, tooltipStyle, useColumns, useEscape, usePrefersReducedMotion, withAlpha,
} from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Earned Media: the headline value card and the four stat cards.
 * The value card splits press from social and opens either side. Each stat card shows its change against
 * the prior period and a weekly trend, then opens into the story behind it: weekly shape, tier mix,
 * outlets, channels, and the standout voices. Everything comes from the tab's own summary.
 * ---------------------------------------------------------------------------------------------- */

const PRESS = 'hsl(226 67% 33%)';
const SOCIAL = 'hsl(42 64% 42%)';
const TIER1 = 'hsl(268 52% 46%)';
const OUTLETS = 'hsl(190 70% 34%)';

interface Totals {
  total_miv?: number; press_miv?: number; social_miv?: number; press_count?: number; distinct_outlets?: number;
  tier1_count?: number; social_count?: number; social_lefty_count?: number; social_lefty_miv?: number;
  social_organic_miv?: number; press_avg_miv?: number;
}

interface Props {
  totals: Totals;
  prior: Totals | null;
  weekly: any[];
  tierMix: any[];
  pressChannelMix: any[];
  socialChannelMix: any[];
  topOutlets: any[];
  topSocial: any[];
}

type Key = 'press' | 'social' | 'placements' | 'outlets' | 'tier1' | 'mentions';

const dayLabel = (d: string): string => {
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

const channelName = (c: string): string => {
  const v = (c || '').toLowerCase();
  if (v === 'twitter') return 'X';
  return titleCase(v) || 'Other';
};

function NewChip() {
  return <span className="font-mono-ui text-[10px] tracking-[0.06em] px-1.5 py-0.5 bg-emerald-50 text-emerald-700">New</span>;
}

function changeNode(current: number, prior: number | null | undefined) {
  if (prior == null) return undefined;
  if (prior === 0) return current > 0 ? <NewChip /> : undefined;
  return <DeltaChip pct={((current - prior) / prior) * 100} title="Compared with the prior period" />;
}

function Bars({ rows, color, reduced }: { rows: { label: string; v: number; right: string; hint?: string }[]; color: string; reduced: boolean }) {
  const max = Math.max(...rows.map(r => r.v), 1);
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between text-xs mb-1 gap-2">
            <span className="font-semibold truncate">{r.label}{r.hint && <span className="font-normal text-muted-foreground"> · {r.hint}</span>}</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{r.right}</span>
          </div>
          <div className="h-2 bg-black/[0.06]">
            <div className="h-full" style={{ width: `${(r.v / max) * 100}%`, background: color, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function WeeklyBars({ data, color, format, label, reduced }: {
  data: { week: string; value: number; extra?: string }[]; color: string; format: (n: number) => string; label: string; reduced: boolean;
}) {
  if (data.length < 2) return <p className="text-sm text-muted-foreground py-10 text-center">Not enough weeks of data yet to draw a trend.</p>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
        <XAxis dataKey="week" tick={axisTick} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
        <YAxis tickFormatter={(v: number) => format(v)} tick={axisTick} axisLine={false} tickLine={false} width={52} allowDecimals={false} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          formatter={(v: number, _n: string, item: any) => [`${format(num(v))}${item?.payload?.extra ? ` · ${item.payload.extra}` : ''}`, label]}
        />
        <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={!reduced} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const EarnedMediaHero = ({ totals, prior, weekly, tierMix, pressChannelMix, socialChannelMix, topOutlets, topSocial }: Props) => {
  const reduced = usePrefersReducedMotion();
  const cols = useColumns({ base: 2, md: 4 });
  const [selected, setSelected] = useState<Key | null>(null);
  const [hoverSeg, setHoverSeg] = useState<'press' | 'social' | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

  const t = totals ?? {};
  const totalMiv = num(t.total_miv);
  const pressMiv = num(t.press_miv);
  const socialMiv = num(t.social_miv);
  const base = pressMiv + socialMiv || totalMiv || 1;
  const pressPct = (pressMiv / base) * 100;
  const socialPct = Math.max(0, 100 - pressPct);

  const weeks = useMemo(
    () => arr<any>(weekly)
      .map(w => ({
        key: String(w.week_start ?? '').slice(0, 10),
        week: dayLabel(w.week_start),
        press_miv: num(w.press_miv), social_miv: num(w.social_miv),
        press_count: num(w.press_count), social_count: num(w.social_count),
      }))
      .filter(w => w.key)
      .sort((a, b) => a.key.localeCompare(b.key)),
    [weekly],
  );

  const tiers = useMemo(() => arr<any>(tierMix).map(r => ({ tier: num(r.tier), count: num(r.count), miv: num(r.miv) })), [tierMix]);
  const pressChannels = useMemo(() => arr<any>(pressChannelMix).map(r => ({ channel: channelName(String(r.channel_type ?? r.channel ?? '')), count: num(r.count), miv: num(r.miv) })), [pressChannelMix]);
  const socialChannels = useMemo(
    () => arr<any>(socialChannelMix).map(r => ({ channel: channelName(String(r.channel ?? '')), count: num(r.count), miv: num(r.miv) })).sort((a, b) => b.miv - a.miv),
    [socialChannelMix],
  );
  const outlets = useMemo(() => arr<any>(topOutlets).map(o => ({ outlet: String(o.outlet ?? ''), tier: o.tier == null ? null : num(o.tier), count: num(o.count), miv: num(o.miv) })).filter(o => o.outlet), [topOutlets]);
  const voices = useMemo(
    () => arr<any>(topSocial).map(s => ({ name: String(s.voice_name ?? s.source_handle ?? 'Creator'), miv: num(s.miv_usd), reach: num(s.potential_reach), channel: channelName(String(s.channel ?? '')) })).filter(v => v.miv > 0).sort((a, b) => b.miv - a.miv),
    [topSocial],
  );

  const pressCount = num(t.press_count);
  const socialCount = num(t.social_count);
  const outletCount = num(t.distinct_outlets);
  const tier1Count = num(t.tier1_count);
  const pressAvg = pressCount ? pressMiv / pressCount : 0;
  const socialAvg = socialCount ? socialMiv / socialCount : 0;

  const stats: { key: Key; label: string; icon: LucideIcon; color: string; value: number; prior: number | null; spark: number[] | null }[] = [
    { key: 'placements', label: 'Press placements', icon: Newspaper, color: PRESS, value: pressCount, prior: prior ? num(prior.press_count) : null, spark: weeks.map(w => w.press_count) },
    { key: 'outlets', label: 'Outlets', icon: Building2, color: OUTLETS, value: outletCount, prior: prior ? num(prior.distinct_outlets) : null, spark: null },
    { key: 'tier1', label: 'Tier 1 placements', icon: Crown, color: TIER1, value: tier1Count, prior: prior ? num(prior.tier1_count) : null, spark: null },
    { key: 'mentions', label: 'Social mentions', icon: Share2, color: SOCIAL, value: socialCount, prior: prior ? num(prior.social_count) : null, spark: weeks.map(w => w.social_count) },
  ];
  const statKeys = stats.map(s => s.key);
  const statIdx = selected ? statKeys.indexOf(selected) : -1;
  const after = insertAfterIndex(statIdx, cols, stats.length);
  const toggle = (k: Key) => setSelected(prev => (prev === k ? null : k));

  const heroSpark = weeks.map(w => w.press_miv + w.social_miv);
  const heroSelected = selected === 'press' || selected === 'social';

  /* ---------- detail bodies ---------- */
  const busiest = (rows: { week: string; v: number }[]) => rows.reduce<{ week: string; v: number } | null>((b, r) => (!b || r.v > b.v ? r : b), null);
  const momentum = (vals: number[]): number | null => {
    if (vals.length < 4) return null;
    const half = Math.floor(vals.length / 2);
    const a = vals.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const b = vals.slice(vals.length - half).reduce((s, v) => s + v, 0) / half;
    return a > 0 ? ((b - a) / a) * 100 : null;
  };

  const renderHeroDetail = (which: 'press' | 'social') => {
    const isPress = which === 'press';
    const color = isPress ? PRESS : SOCIAL;
    const miv = isPress ? pressMiv : socialMiv;
    const count = isPress ? pressCount : socialCount;
    const series = weeks.map(w => ({ week: w.week, value: isPress ? w.press_miv : w.social_miv, extra: `${fmt(isPress ? w.press_count : w.social_count)} ${isPress ? 'placements' : 'mentions'}` }));
    const best = busiest(series.map(s => ({ week: s.week, v: s.value })));
    const insights: string[] = [];
    insights.push(`${isPress ? 'Press' : 'Social'} is ${Math.round(isPress ? pressPct : socialPct)}% of all media impact value.`);
    if (pressAvg > 0 && socialAvg > 0) {
      const ratio = isPress ? pressAvg / socialAvg : socialAvg / pressAvg;
      if (ratio >= 1.5) insights.push(`An average ${isPress ? 'press placement' : 'social mention'} is worth ${ratio.toFixed(1)}x an average ${isPress ? 'social mention' : 'press placement'}.`);
    }
    if (best && best.v > 0) insights.push(`Strongest week: ${best.week}, with ${fmtMoney(best.v)}.`);
    let rightRows: { label: string; v: number; right: string; hint?: string }[] = [];
    let rightTitle = '';
    if (isPress) {
      rightTitle = 'Online vs print (by value)';
      const totalM = pressChannels.reduce((s, r) => s + r.miv, 0);
      rightRows = pressChannels.map(r => ({ label: r.channel, v: r.miv, right: `${fmtMoney(r.miv)} · ${fmt(r.count)}`, hint: totalM ? `${Math.round((r.miv / totalM) * 100)}%` : undefined }));
      if (pressChannels.length > 1) {
        const top = [...pressChannels].sort((a, b) => b.count - a.count)[0];
        const ct = pressChannels.reduce((s, r) => s + r.count, 0);
        if (top && ct && totalM) insights.push(`${top.channel} delivers ${Math.round((top.count / ct) * 100)}% of placements and ${Math.round((top.miv / totalM) * 100)}% of press value.`);
      }
    } else {
      rightTitle = 'Social value by channel';
      const totalM = socialChannels.reduce((s, r) => s + r.miv, 0);
      rightRows = socialChannels.map(r => ({ label: r.channel, v: r.miv, right: `${fmtMoney(r.miv)} · ${fmt(r.count)}`, hint: totalM ? `${Math.round((r.miv / totalM) * 100)}%` : undefined }));
      if (socialChannels[0] && totalM) insights.push(`${socialChannels[0].channel} drives ${Math.round((socialChannels[0].miv / totalM) * 100)}% of social value.`);
      if (voices[0] && socialMiv > 0) insights.push(`${voices[0].name}'s top post alone is worth ${fmtMoney(voices[0].miv)}, ${Math.round((voices[0].miv / socialMiv) * 100)}% of social value.`);
      if (num(t.social_lefty_count) === 0 && num(t.social_organic_miv) > 0) insights.push('All social value so far comes from organic mentions, not paid activations.');
    }
    return (
      <DetailShell
        id="earned-media-detail"
        color={color}
        icon={isPress ? Newspaper : Share2}
        label={isPress ? 'Press value' : 'Social value'}
        value={fmtMoney(miv)}
        sub={`${fmt(count)} ${isPress ? 'placements' : 'mentions'}${count ? `, ${fmtMoney(miv / count)} each` : ''}`}
        blurb={isPress
          ? 'The dollar value Launchmetrics assigns to earned press coverage, based on outlet reach and placement type.'
          : 'The dollar value Launchmetrics assigns to social posts that mention the brand, based on reach and engagement.'}
        onClose={close}
      >
        <div className="grid gap-6 lg:grid-cols-5 mt-5">
          <div className="lg:col-span-3">
            <SubLabel>{`${isPress ? 'Press' : 'Social'} value by week`}</SubLabel>
            <WeeklyBars data={series} color={color} format={fmtMoney} label={isPress ? 'Press value' : 'Social value'} reduced={reduced} />
          </div>
          <div className="lg:col-span-2">
            <SubLabel>{rightTitle}</SubLabel>
            {rightRows.length ? <Bars rows={rightRows} color={color} reduced={reduced} /> : <p className="text-sm text-muted-foreground">No channel breakdown yet.</p>}
          </div>
        </div>
        <Chips items={insights.slice(0, 4)} color={color} />
      </DetailShell>
    );
  };

  const renderStatDetail = (key: Key) => {
    const insights: string[] = [];
    if (key === 'placements') {
      const series = weeks.map(w => ({ week: w.week, value: w.press_count, extra: fmtMoney(w.press_miv) }));
      const best = busiest(series.map(s => ({ week: s.week, v: s.value })));
      const mom = momentum(series.map(s => s.value));
      const online = pressChannels.find(c => c.channel.toLowerCase() === 'online');
      const chTotal = pressChannels.reduce((s, r) => s + r.count, 0);
      if (best && best.v > 0) insights.push(`Busiest week: ${best.week}, with ${fmt(best.v)} placements.`);
      if (mom != null && Math.abs(mom) >= 10) insights.push(`Recent weeks are running ${Math.round(Math.abs(mom))}% ${mom > 0 ? 'above' : 'below'} the early weeks.`);
      if (outletCount > 0 && pressCount > 0) insights.push(`That is ${(pressCount / outletCount).toFixed(1)} placements per outlet on average.`);
      if (pressAvg > 0) insights.push(`Each placement is worth about ${fmtMoney(pressAvg)} on average.`);
      return (
        <DetailShell id="earned-media-detail" color={PRESS} icon={Newspaper} label="Press placements" value={fmt(pressCount)} blurb="Articles and print features that mention the brand, tracked by Launchmetrics." onClose={close}>
          <div className="grid gap-6 lg:grid-cols-5 mt-5">
            <div className="lg:col-span-3">
              <SubLabel>Placements by week</SubLabel>
              <WeeklyBars data={series} color={PRESS} format={fmt} label="Placements" reduced={reduced} />
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
              <Tile label="Value per placement" value={pressAvg ? fmtMoney(pressAvg) : '-'} />
              <Tile label="Placements per outlet" value={outletCount ? (pressCount / outletCount).toFixed(1) : '-'} />
              <Tile label="Online share" value={online && chTotal ? `${Math.round((online.count / chTotal) * 100)}%` : '-'} hint="of all placements" />
              <Tile label="Tier 1 share" value={pressCount ? `${((tier1Count / pressCount) * 100).toFixed(1)}%` : '-'} hint="of all placements" />
            </div>
          </div>
          <Chips items={insights.slice(0, 4)} color={PRESS} />
        </DetailShell>
      );
    }
    if (key === 'outlets') {
      const rows = [...outlets].sort((a, b) => b.count - a.count || b.miv - a.miv).slice(0, 8);
      const top3 = [...outlets].sort((a, b) => b.miv - a.miv).slice(0, 3).reduce((s, o) => s + o.miv, 0);
      const repeat = outlets.filter(o => o.count > 1).length;
      if (pressMiv > 0 && top3 > 0) insights.push(`Your three most valuable outlets account for ${Math.round((top3 / pressMiv) * 100)}% of press value.`);
      if (outlets.length && repeat > 0) insights.push(`${repeat} of your top ${outlets.length} outlets have covered you more than once.`);
      if (outletCount > 0 && pressCount > 0) insights.push(`${fmt(outletCount)} different outlets across ${fmt(pressCount)} placements shows a wide spread, not a few friendly publications.`);
      const tier = (n: number | null) => (n ? `Tier ${n}` : 'Unrated');
      return (
        <DetailShell id="earned-media-detail" color={OUTLETS} icon={Building2} label="Outlets" value={fmt(outletCount)} blurb="Distinct publications and sites that have covered the brand in this period." onClose={close}>
          <div className="grid gap-6 lg:grid-cols-5 mt-5">
            <div className="lg:col-span-3">
              <SubLabel>Top outlets by placements</SubLabel>
              {rows.length ? (
                <Bars
                  rows={rows.map(o => ({ label: o.outlet, v: o.count, right: `${fmt(o.count)} · ${fmtMoney(o.miv)}`, hint: tier(o.tier) }))}
                  color={OUTLETS}
                  reduced={reduced}
                />
              ) : <p className="text-sm text-muted-foreground">No outlet detail for this period.</p>}
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
              <Tile label="Outlets" value={fmt(outletCount)} />
              <Tile label="Placements per outlet" value={outletCount ? (pressCount / outletCount).toFixed(1) : '-'} />
              <Tile label="Top 3 value share" value={pressMiv > 0 && top3 > 0 ? `${Math.round((top3 / pressMiv) * 100)}%` : '-'} hint="of press value" />
              <Tile label="Repeat outlets" value={outlets.length ? String(repeat) : '-'} hint={outlets.length ? `of your top ${outlets.length}` : undefined} />
            </div>
          </div>
          <Chips items={insights.slice(0, 4)} color={OUTLETS} />
        </DetailShell>
      );
    }
    if (key === 'tier1') {
      const named = tiers.filter(r => r.tier > 0);
      const t1 = tiers.find(r => r.tier === 1);
      const t3 = tiers.find(r => r.tier === 3);
      const t1Avg = t1 && t1.count ? t1.miv / t1.count : 0;
      const t3Avg = t3 && t3.count ? t3.miv / t3.count : 0;
      const pressTotalMiv = tiers.reduce((s, r) => s + r.miv, 0);
      const t1Outlets = outlets.filter(o => o.tier === 1);
      if (t1Avg > 0 && t3Avg > 0) insights.push(`A Tier 1 placement is worth ${(t1Avg / t3Avg).toFixed(1)}x a Tier 3 placement on average.`);
      if (t1 && pressCount && pressTotalMiv) insights.push(`Tier 1 is ${((t1.count / pressCount) * 100).toFixed(1)}% of placements and ${((t1.miv / pressTotalMiv) * 100).toFixed(1)}% of press value.`);
      if (t1Outlets.length) insights.push(`Tier 1 outlets in your top list: ${t1Outlets.slice(0, 3).map(o => o.outlet).join(', ')}.`);
      if (!t1 || t1.count === 0) insights.push('No Tier 1 placements yet. Tier 1 outlets are the most influential titles, so they are worth targeting.');
      return (
        <DetailShell id="earned-media-detail" color={TIER1} icon={Crown} label="Tier 1 placements" value={fmt(tier1Count)} blurb="Coverage in the most influential outlets, as ranked by Launchmetrics. Fewer placements, but they carry the most authority." onClose={close}>
          <div className="grid gap-6 lg:grid-cols-5 mt-5">
            <div className="lg:col-span-3">
              <SubLabel>Placements by tier</SubLabel>
              {named.length ? (
                <Bars
                  rows={named.map(r => ({ label: `Tier ${r.tier}`, v: r.count, right: `${fmt(r.count)} · ${fmtMoney(r.miv)}`, hint: r.count ? `${fmtMoney(r.miv / r.count)} each` : undefined }))}
                  color={TIER1}
                  reduced={reduced}
                />
              ) : <p className="text-sm text-muted-foreground">No tiered placements in this period.</p>}
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
              <Tile label="Tier 1 placements" value={fmt(tier1Count)} />
              <Tile label="Share of placements" value={pressCount ? `${((tier1Count / pressCount) * 100).toFixed(1)}%` : '-'} />
              <Tile label="Value each (Tier 1)" value={t1Avg ? fmtMoney(t1Avg) : '-'} />
              <Tile label="Value each (Tier 3)" value={t3Avg ? fmtMoney(t3Avg) : '-'} />
            </div>
          </div>
          <Chips items={insights.slice(0, 4)} color={TIER1} />
        </DetailShell>
      );
    }
    // mentions
    const series = weeks.map(w => ({ week: w.week, value: w.social_count, extra: fmtMoney(w.social_miv) }));
    const best = busiest(series.map(s => ({ week: s.week, v: s.value })));
    const mom = momentum(series.map(s => s.value));
    const byCount = [...socialChannels].sort((a, b) => b.count - a.count);
    const cTotal = socialChannels.reduce((s, r) => s + r.count, 0);
    if (best && best.v > 0) insights.push(`Busiest week: ${best.week}, with ${fmt(best.v)} mentions.`);
    if (mom != null && Math.abs(mom) >= 10) insights.push(`Recent weeks are running ${Math.round(Math.abs(mom))}% ${mom > 0 ? 'above' : 'below'} the early weeks.`);
    if (byCount[0] && cTotal) insights.push(`${byCount[0].channel} accounts for ${Math.round((byCount[0].count / cTotal) * 100)}% of mentions.`);
    if (socialAvg > 0) insights.push(`Each mention is worth about ${fmtMoney(socialAvg)} on average.`);
    return (
      <DetailShell id="earned-media-detail" color={SOCIAL} icon={Share2} label="Social mentions" value={fmt(socialCount)} blurb="Public social posts that mention the brand, tracked by Launchmetrics across Instagram, TikTok, YouTube and more." onClose={close}>
        <div className="grid gap-6 lg:grid-cols-5 mt-5">
          <div className="lg:col-span-3">
            <SubLabel>Mentions by week</SubLabel>
            <WeeklyBars data={series} color={SOCIAL} format={fmt} label="Mentions" reduced={reduced} />
          </div>
          <div className="lg:col-span-2">
            <SubLabel>Mentions by channel</SubLabel>
            {byCount.length ? (
              <Bars rows={byCount.map(r => ({ label: r.channel, v: r.count, right: `${fmt(r.count)} · ${fmtMoney(r.miv)}`, hint: cTotal ? `${Math.round((r.count / cTotal) * 100)}%` : undefined }))} color={SOCIAL} reduced={reduced} />
            ) : <p className="text-sm text-muted-foreground">No channel breakdown yet.</p>}
          </div>
        </div>
        <Chips items={insights.slice(0, 4)} color={SOCIAL} />
      </DetailShell>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ---------- value card ---------- */}
      <div
        className="section-card border p-5 md:p-6 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${withAlpha(PRESS, 0.07)}, ${withAlpha(SOCIAL, 0.09)} 70%, transparent)` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Total Media Impact Value</span>
            <p className="font-display text-[44px] md:text-[56px] leading-none font-bold mt-2 tabular-nums">
              <CountUp value={totalMiv} format={fmtMoney} />
            </p>
            {prior && num(prior.total_miv) > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <DeltaChip pct={((totalMiv - num(prior.total_miv)) / num(prior.total_miv)) * 100} title="Compared with the prior period" />
                <span className="text-[11px] text-muted-foreground">vs prior period</span>
              </div>
            )}
          </div>
          {heroSpark.length >= 2 && (
            <div className="hidden sm:block" aria-hidden>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1 text-right">Weekly value</p>
              <Sparkline values={heroSpark} color={PRESS} width={190} height={44} />
            </div>
          )}
        </div>

        <div className="mt-5" onMouseLeave={() => setHoverSeg(null)}>
          <div className="flex h-5 w-full overflow-hidden bg-muted">
            {([
              { key: 'press' as const, label: 'Press', pct: pressPct, color: PRESS },
              { key: 'social' as const, label: 'Social', pct: socialPct, color: SOCIAL },
            ]).map(seg => (
              <button
                key={seg.key}
                type="button"
                aria-pressed={selected === seg.key}
                aria-label={`${seg.label}: ${fmtMoney(seg.key === 'press' ? pressMiv : socialMiv)}, ${Math.round(seg.pct)}% of media impact value. Open details.`}
                onMouseEnter={() => setHoverSeg(seg.key)}
                onFocus={() => setHoverSeg(seg.key)}
                onBlur={() => setHoverSeg(null)}
                onClick={() => toggle(seg.key)}
                className="h-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{
                  width: `${seg.pct}%`,
                  minWidth: seg.pct > 0 ? 3 : 0,
                  background: seg.color,
                  opacity: hoverSeg && hoverSeg !== seg.key ? 0.55 : 1,
                  filter: hoverSeg === seg.key ? 'brightness(1.1) saturate(1.1)' : undefined,
                  transition: reduced ? undefined : 'opacity 160ms ease, filter 160ms ease',
                }}
              >
                {seg.pct >= 12 ? `${seg.label} ${Math.round(seg.pct)}%` : ''}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
            {([
              { key: 'press' as const, label: 'Press', color: PRESS, miv: pressMiv, pct: pressPct, p: prior ? num(prior.press_miv) : null },
              { key: 'social' as const, label: 'Social', color: SOCIAL, miv: socialMiv, pct: socialPct, p: prior ? num(prior.social_miv) : null },
            ]).map(row => {
              const on = selected === row.key;
              return (
                <button
                  key={row.key}
                  type="button"
                  aria-pressed={on}
                  onMouseEnter={() => setHoverSeg(row.key)}
                  onMouseLeave={() => setHoverSeg(null)}
                  onClick={() => toggle(row.key)}
                  className="flex items-center gap-2 text-xs px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2"
                  style={{ background: on || hoverSeg === row.key ? withAlpha(row.color, 0.12) : undefined, boxShadow: on ? `inset 3px 0 0 ${row.color}` : undefined }}
                >
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: row.color }} />
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{row.label}</span>
                  <span className="font-display font-bold tabular-nums">{fmtMoney(row.miv)}</span>
                  <span className="text-muted-foreground tabular-nums">{Math.round(row.pct)}%</span>
                  {row.p != null && row.p > 0 && <DeltaChip pct={((row.miv - row.p) / row.p) * 100} />}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-4">
          MIV (Media Impact Value) is Launchmetrics' dollar valuation of earned coverage. Select press or social to see what is behind it.
        </p>
      </div>

      {heroSelected && renderHeroDetail(selected as 'press' | 'social')}

      {/* ---------- stat cards ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={s.key} className="contents">
            <MetricCard
              color={s.color}
              icon={s.icon}
              label={s.label}
              active={selected === s.key}
              onClick={() => toggle(s.key)}
              controls="earned-media-detail"
              delta={changeNode(s.value, s.prior)}
            >
              <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3">
                <CountUp value={s.value} format={fmt} />
              </p>
              <div className="mt-3 h-7">
                {s.spark && s.spark.length >= 2 ? (
                  <Sparkline values={s.spark} color={s.color} width={120} height={28} />
                ) : s.key === 'outlets' ? (
                  <p className="text-[11px] text-muted-foreground">{pressCount && outletCount ? `${(pressCount / outletCount).toFixed(1)} placements per outlet` : ''}</p>
                ) : s.key === 'tier1' ? (
                  <p className="text-[11px] text-muted-foreground">{pressCount ? `${((tier1Count / pressCount) * 100).toFixed(1)}% of placements` : ''}</p>
                ) : null}
              </div>
            </MetricCard>

            {i === after && selected && statKeys.includes(selected) && renderStatDetail(selected)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EarnedMediaHero;
