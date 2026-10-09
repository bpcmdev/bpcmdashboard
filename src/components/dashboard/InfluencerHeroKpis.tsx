import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DollarSign, Eye, Heart, Images, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Sparkline from './Sparkline';
import {
  Chips, CountUp, DeltaChip, DetailShell, MetricCard, SubLabel, Tile, arr, axisTick, fmt, fmtMoney, hsl,
  insertAfterIndex, num, tooltipStyle, useColumns, useEscape, usePrefersReducedMotion,
} from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Influencer Intelligence: the five headline cards. Each shows the number, a month-over-month change
 * and a trend line. Selecting one opens the month-by-month story and what the number works out to per
 * post, per creator and per 1,000 people reached. Data comes from the tab's own monthly rollup.
 * ---------------------------------------------------------------------------------------------- */

type Key = 'posts' | 'reach' | 'emv' | 'eng' | 'authors';

interface MonthRow { key: string; posts: number; reach: number; emv: number; authors: number; eng: number }

interface Props {
  accent: string;
  kpis: Record<Key, number>;
  monthly: MonthRow[];
  topCampaign: { name: string; emv: number } | null;
}

interface MetricDef {
  key: Key;
  label: string;
  icon: LucideIcon;
  additive: boolean;
  format: (n: number) => string;
  blurb: string;
}

const METRICS: MetricDef[] = [
  { key: 'posts', label: 'Total posts', icon: Images, additive: true, format: fmt,
    blurb: 'Every creator post tracked in the selected window, across Instagram and TikTok.' },
  { key: 'reach', label: 'Total reach', icon: Eye, additive: true, format: fmt,
    blurb: 'The estimated audience those posts could have reached. It is an estimate, not a count of unique people.' },
  { key: 'emv', label: 'Total EMV', icon: DollarSign, additive: true, format: fmtMoney,
    blurb: 'Earned media value: roughly what it would cost to buy the same exposure as paid advertising, as calculated by the creator platform.' },
  { key: 'eng', label: 'Avg engagement', icon: Heart, additive: false, format: n => `${n.toFixed(2)}%`,
    blurb: 'The average share of an audience that liked, commented on or shared a post. Higher means content is resonating, not just being seen.' },
  { key: 'authors', label: 'Active influencers', icon: Users, additive: false, format: fmt,
    blurb: 'Creators who posted in the selected window.' },
];

const monthLabel = (key: string, withYear = true): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
};

function fillMonths(rows: MonthRow[]): MonthRow[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.key.localeCompare(b.key));
  const byKey = new Map(sorted.map(r => [r.key, r]));
  const out: MonthRow[] = [];
  let [y, m] = sorted[0].key.split('-').map(Number);
  const [ey, em] = sorted[sorted.length - 1].key.split('-').map(Number);
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard++ < 240) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(byKey.get(key) ?? { key, posts: 0, reach: 0, emv: 0, authors: 0, eng: 0 });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

const COLORS: Record<Key, (accent: string) => string> = {
  posts: accent => accent,
  reach: () => hsl(200, 75, 40),
  emv: () => 'hsl(40 70% 40%)',
  eng: () => hsl(340, 72, 46),
  authors: () => hsl(165, 62, 32),
};

const InfluencerHeroKpis = ({ accent, kpis, monthly, topCampaign }: Props) => {
  const reduced = usePrefersReducedMotion();
  const cols = useColumns({ base: 2, md: 3, lg: 5 });
  const [selected, setSelected] = useState<Key | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

  const months = useMemo(() => fillMonths(arr<MonthRow>(monthly)), [monthly]);
  const currentKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const complete = useMemo(() => months.filter(m => m.key < currentKey), [months, currentKey]);

  const selectedIdx = selected ? METRICS.findIndex(m => m.key === selected) : -1;
  const after = insertAfterIndex(selectedIdx, cols, METRICS.length);

  const mom = (k: Key): number | null => {
    if (complete.length < 2) return null;
    const last = num(complete[complete.length - 1][k]);
    const prev = num(complete[complete.length - 2][k]);
    if (prev <= 0) return null;
    return ((last - prev) / prev) * 100;
  };

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {METRICS.map((m, i) => {
        const color = COLORS[m.key](accent);
        const value = num(kpis[m.key]);
        const sparkRows = (complete.length >= 2 ? complete : months).slice(-8);
        const spark = sparkRows.map(r => num(r[m.key]));
        return (
          <div key={m.key} className="contents">
            <MetricCard
              color={color}
              icon={m.icon}
              label={m.label}
              active={selected === m.key}
              onClick={() => setSelected(prev => (prev === m.key ? null : m.key))}
              controls="influencer-hero-detail"
              delta={<DeltaChip pct={mom(m.key)} title="Last full month compared with the month before" />}
            >
              <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3">
                <CountUp value={value} format={m.format} />
              </p>
              <div className="mt-3"><Sparkline values={spark} color={color} width={120} height={30} /></div>
            </MetricCard>

            {i === after && selected && (
              <HeroDetail
                def={METRICS[selectedIdx]}
                color={COLORS[METRICS[selectedIdx].key](accent)}
                kpis={kpis}
                months={months}
                complete={complete}
                currentKey={currentKey}
                mom={mom(METRICS[selectedIdx].key)}
                topCampaign={topCampaign}
                reduced={reduced}
                onClose={close}
              />
            )}
          </div>
        );
      })}
    </section>
  );
};

function HeroDetail({ def, color, kpis, months, complete, currentKey, mom, topCampaign, reduced, onClose }: {
  def: MetricDef; color: string; kpis: Record<Key, number>; months: MonthRow[]; complete: MonthRow[]; currentKey: string;
  mom: number | null; topCampaign: { name: string; emv: number } | null; reduced: boolean; onClose: () => void;
}) {
  const k = def.key;
  const total = num(kpis[k]);
  const chart = months.map(r => ({ key: r.key, label: monthLabel(r.key), value: num(r[k]), partial: r.key === currentKey }));
  const hasPartial = chart.some(c => c.partial);

  const best = chart.filter(c => !c.partial).reduce<{ label: string; value: number } | null>((b, c) => (!b || c.value > b.value ? { label: c.label, value: c.value } : b), null);
  const last = complete.length ? num(complete[complete.length - 1][k]) : 0;
  const lastLabel = complete.length ? monthLabel(complete[complete.length - 1].key) : '';
  const lastThree = complete.slice(-3).map(r => num(r[k]));
  const avg3 = lastThree.length ? lastThree.reduce((s, v) => s + v, 0) / lastThree.length : 0;
  const partialRow = months.find(m => m.key === currentKey);
  const partialValue = partialRow ? num(partialRow[k]) : 0;

  const posts = num(kpis.posts);
  const reach = num(kpis.reach);
  const emv = num(kpis.emv);
  const authors = num(kpis.authors);

  const tiles: { label: string; value: string; hint?: string }[] = [];
  if (k === 'posts') {
    if (authors) tiles.push({ label: 'Posts per creator', value: (posts / authors).toFixed(1) });
    if (posts) tiles.push({ label: 'Reach per post', value: fmt(reach / posts) });
    if (posts) tiles.push({ label: 'EMV per post', value: fmtMoney(emv / posts) });
  } else if (k === 'reach') {
    if (posts) tiles.push({ label: 'Reach per post', value: fmt(reach / posts) });
    if (authors) tiles.push({ label: 'Reach per creator', value: fmt(reach / authors) });
    if (reach) tiles.push({ label: 'EMV per 1,000 reached', value: fmtMoney((emv / reach) * 1000), hint: 'Value created for every thousand people reached' });
  } else if (k === 'emv') {
    if (posts) tiles.push({ label: 'EMV per post', value: fmtMoney(emv / posts) });
    if (authors) tiles.push({ label: 'EMV per creator', value: fmtMoney(emv / authors) });
    if (reach) tiles.push({ label: 'EMV per 1,000 reached', value: fmtMoney((emv / reach) * 1000) });
  } else if (k === 'authors') {
    if (authors) tiles.push({ label: 'Posts per creator', value: (posts / authors).toFixed(1) });
    if (authors) tiles.push({ label: 'Reach per creator', value: fmt(reach / authors) });
    if (authors) tiles.push({ label: 'EMV per creator', value: fmtMoney(emv / authors) });
  } else {
    const rates = complete.map(r => ({ label: monthLabel(r.key), v: num(r.eng) })).filter(r => r.v > 0);
    if (rates.length) {
      const hi = rates.reduce((a, b) => (b.v > a.v ? b : a));
      const lo = rates.reduce((a, b) => (b.v < a.v ? b : a));
      tiles.push({ label: 'Highest month', value: `${hi.v.toFixed(2)}%`, hint: hi.label });
      tiles.push({ label: 'Lowest month', value: `${lo.v.toFixed(2)}%`, hint: lo.label });
    }
  }

  const insights: string[] = [];
  if (best && best.value > 0) insights.push(`Biggest month so far: ${best.label}, with ${def.format(best.value)}.`);
  if (mom != null && Math.abs(mom) >= 3 && complete.length >= 2) {
    insights.push(`${lastLabel} was ${Math.abs(mom).toFixed(0)}% ${mom > 0 ? 'above' : 'below'} the month before.`);
  }
  if (def.additive && partialValue > 0 && last > 0) {
    insights.push(`This month so far: ${def.format(partialValue)}, ${Math.round((partialValue / last) * 100)}% of ${lastLabel}'s total.`);
  }
  if (avg3 > 0 && last > 0 && Math.abs(last - avg3) / avg3 >= 0.1 && complete.length >= 3) {
    insights.push(`${lastLabel} ran ${Math.round((Math.abs(last - avg3) / avg3) * 100)}% ${last > avg3 ? 'above' : 'below'} the three-month average.`);
  }
  if (k === 'emv' && topCampaign && emv > 0 && topCampaign.emv > 0) {
    insights.push(`${topCampaign.name} brings ${Math.round((topCampaign.emv / emv) * 100)}% of all EMV.`);
  }

  return (
    <DetailShell
      id="influencer-hero-detail"
      color={color}
      icon={def.icon}
      label={def.label}
      value={def.format(total)}
      blurb={def.blurb}
      onClose={onClose}
    >
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>Month by month{hasPartial ? ' (the current month is lighter, still in progress)' : ''}</SubLabel>
          {chart.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} minTickGap={12} />
                <YAxis tickFormatter={(v: number) => def.format(v)} tick={axisTick} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number) => [def.format(num(v)), def.label]}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={!reduced} animationDuration={700}>
                  {chart.map(c => <Cell key={c.key} fill={color} fillOpacity={c.partial ? 0.4 : 0.9} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">Not enough months of data yet to draw a trend.</p>
          )}
        </div>

        <div className="lg:col-span-2">
          <SubLabel>What it works out to</SubLabel>
          {tiles.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              {tiles.map(t => <Tile key={t.label} label={t.label} value={t.value} hint={t.hint} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough data to work out the per-post figures yet.</p>
          )}
        </div>
      </div>

      <Chips items={insights.slice(0, 4)} color={color} />
    </DetailShell>
  );
}

export default InfluencerHeroKpis;
