import { useCallback, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Eye, ListOrdered, PieChart, Smile } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Sparkline from './Sparkline';
import {
  Chips, CountUp, DeltaChip, DetailShell, MetricCard, SubLabel, Tile, arr, axisTick, insertAfterIndex, num,
  tooltipStyle, useColumns, useEscape, usePrefersReducedMotion, withAlpha,
} from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * AI Visibility: headline cards (visibility, share of voice, average position, sentiment) and the
 * competitive ladder. Every card carries its rank in the competitive set and a trend line, and opens into
 * the trend against the leader and the full ladder for that metric.
 * ---------------------------------------------------------------------------------------------- */

interface KpiRow { metric: 'visibility' | 'sentiment' | 'position' | 'share_of_voice'; current_value: number | null; previous_value: number | null }
interface TrendRow { date: string; brand_id: string; brand_name: string; is_client_brand: boolean; visibility: number | null; share_of_voice: number | null; sentiment: number | null; avg_position: number | null }
interface BrandRow { brand_id: string; brand_name: string; is_client_brand: boolean; visibility: number | null; sentiment: number | null; avg_position: number | null; share_of_voice: number | null; mention_count: number | null }

type Key = 'visibility' | 'share_of_voice' | 'position' | 'sentiment';
type Field = 'visibility' | 'share_of_voice' | 'avg_position' | 'sentiment';

interface Def { key: Key; field: Field; label: string; icon: LucideIcon; color: string; lowerBetter?: boolean; fmt: (n: number) => string; blurb: string; deltaSuffix: string; deltaScale: number }

const DEFS = (accent: string): Def[] => [
  { key: 'visibility', field: 'visibility', label: 'Visibility', icon: Eye, color: accent, fmt: n => `${(n * 100).toFixed(1)}%`, deltaSuffix: 'pts', deltaScale: 100,
    blurb: 'How often the brand appears at all when AI assistants answer the prompts we track.' },
  { key: 'share_of_voice', field: 'share_of_voice', label: 'Share of voice', icon: PieChart, color: 'hsl(268 55% 48%)', fmt: n => `${(n * 100).toFixed(1)}%`, deltaSuffix: 'pts', deltaScale: 100,
    blurb: 'The brand\u2019s share of all brand mentions in those answers, against the competitive set.' },
  { key: 'position', field: 'avg_position', label: 'Avg position', icon: ListOrdered, color: 'hsl(190 70% 34%)', lowerBetter: true, fmt: n => n.toFixed(1), deltaSuffix: 'pos', deltaScale: 1,
    blurb: 'Where the brand lands in the list when it is mentioned. Lower is better: 1 means named first.' },
  { key: 'sentiment', field: 'sentiment', label: 'Sentiment', icon: Smile, color: 'hsl(152 55% 34%)', fmt: n => Math.round(n).toString(), deltaSuffix: 'pts', deltaScale: 1,
    blurb: 'How positively AI talks about the brand, from 0 to 100. Around 50 is neutral.' },
];

const dayLabel = (d: string) => {
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function rankOf(rows: BrandRow[], field: Field, lowerBetter?: boolean) {
  const valid = rows.filter(r => r[field] != null);
  const sorted = [...valid].sort((a, b) => (lowerBetter ? num(a[field]) - num(b[field]) : num(b[field]) - num(a[field])));
  const own = sorted.findIndex(r => r.is_client_brand);
  return { sorted, rank: own >= 0 ? own + 1 : null, total: sorted.length };
}

export function AiKpiCards({ kpis, trend, summary, loading, accent }: { kpis: KpiRow[]; trend: TrendRow[]; summary: BrandRow[]; loading: boolean; accent: string }) {
  const reduced = usePrefersReducedMotion();
  const cols = useColumns({ base: 2, lg: 4 });
  const [selected, setSelected] = useState<Key | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);
  const defs = useMemo(() => DEFS(accent), [accent]);
  const byMetric = useMemo(() => new Map(arr<KpiRow>(kpis).map(r => [r.metric, r])), [kpis]);
  const ownTrend = useMemo(() => arr<TrendRow>(trend).filter(r => r.is_client_brand).sort((a, b) => a.date.localeCompare(b.date)), [trend]);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-36 bg-muted/50 animate-pulse" />)}</div>;

  const idx = selected ? defs.findIndex(d => d.key === selected) : -1;
  const after = insertAfterIndex(idx, cols, defs.length);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {defs.map((d, i) => {
        const r = byMetric.get(d.key);
        const cur = r?.current_value;
        const prev = r?.previous_value;
        const delta = cur != null && prev != null ? (cur - prev) * d.deltaScale : null;
        const { rank, total } = rankOf(arr<BrandRow>(summary), d.field, d.lowerBetter);
        return (
          <div key={d.key} className="contents">
            <MetricCard
              color={d.color}
              icon={d.icon}
              label={d.label}
              active={selected === d.key}
              onClick={() => setSelected(p => (p === d.key ? null : d.key))}
              controls="ai-kpi-detail"
              delta={<DeltaChip pct={delta} invert={d.lowerBetter} suffix={d.deltaSuffix} title="Compared with the previous period" />}
            >
              <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3" style={{ color: d.color }}>
                {cur != null ? <CountUp value={cur} format={d.fmt} /> : '—'}
              </p>
              <div className="flex items-center justify-between gap-2 mt-2">
                {rank ? <span className="font-mono-ui text-[10px] tracking-[0.1em] px-1.5 py-0.5" style={{ background: withAlpha(d.color, 0.12), color: d.color }}>#{rank} of {total}</span> : <span />}
                <Sparkline values={ownTrend.map(t => num(t[d.field]))} color={d.color} width={90} height={24} />
              </div>
            </MetricCard>
            {i === after && selected && (
              <KpiDetail def={defs[idx]} kpi={byMetric.get(defs[idx].key) ?? null} trend={arr<TrendRow>(trend)} summary={arr<BrandRow>(summary)} reduced={reduced} onClose={close} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KpiDetail({ def, kpi, trend, summary, reduced, onClose }: { def: Def; kpi: KpiRow | null; trend: TrendRow[]; summary: BrandRow[]; reduced: boolean; onClose: () => void }) {
  const { sorted, rank, total } = rankOf(summary, def.field, def.lowerBetter);
  const own = sorted.find(r => r.is_client_brand) ?? null;
  const leader = sorted.find(r => !r.is_client_brand) ?? null;
  const ownIdx = sorted.findIndex(r => r.is_client_brand);
  const above = ownIdx > 0 ? sorted[ownIdx - 1] : null;
  const below = ownIdx >= 0 && ownIdx < sorted.length - 1 ? sorted[ownIdx + 1] : null;

  const dates = [...new Set(trend.map(t => t.date))].sort();
  const series = dates.map(dt => {
    const rows = trend.filter(t => t.date === dt);
    const o = rows.find(t => t.is_client_brand);
    const l = leader ? rows.find(t => t.brand_id === leader.brand_id) : null;
    const comps = rows.filter(t => !t.is_client_brand && t[def.field] != null);
    return { date: dt, you: o?.[def.field] ?? null, leader: l?.[def.field] ?? null, avg: comps.length ? comps.reduce((s, t) => s + num(t[def.field]), 0) / comps.length : null };
  });

  const max = Math.max(...sorted.map(r => num(r[def.field])), 0.0001);
  const insights: string[] = [];
  if (rank && own) insights.push(rank === 1 ? `${own.brand_name} leads the competitive set on ${def.label.toLowerCase()}.` : `${own.brand_name} ranks #${rank} of ${total} on ${def.label.toLowerCase()}.`);
  if (above && own) insights.push(`${above.brand_name} is just ahead at ${def.fmt(num(above[def.field]))}.`);
  if (below && own) insights.push(`${below.brand_name} trails at ${def.fmt(num(below[def.field]))}.`);
  if (kpi?.current_value != null && kpi.previous_value != null) {
    const d = (kpi.current_value - kpi.previous_value) * def.deltaScale;
    if (Math.abs(d) >= 0.05) {
      const better = def.lowerBetter ? d < 0 : d > 0;
      insights.push(`${better ? 'Improved' : 'Slipped'} by ${Math.abs(d).toFixed(def.deltaScale === 100 ? 1 : def.key === 'position' ? 2 : 0)} ${def.deltaSuffix} on the previous period.`);
    }
  }

  return (
    <DetailShell id="ai-kpi-detail" color={def.color} icon={def.icon} label={def.label} value={kpi?.current_value != null ? def.fmt(kpi.current_value) : '—'} sub={rank ? `#${rank} of ${total} brands` : undefined} blurb={def.blurb} onClose={onClose}>
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>{`You vs ${leader ? leader.brand_name : 'the leader'} and the competitor average`}</SubLabel>
          {series.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayLabel} tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis reversed={!!def.lowerBetter} tickFormatter={(v: number) => def.fmt(v)} tick={axisTick} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} />
                <Tooltip {...tooltipStyle} labelFormatter={(d: string) => dayLabel(d)} formatter={(v: number, n: string) => [v == null ? '—' : def.fmt(num(v)), n === 'you' ? 'You' : n === 'leader' ? (leader?.brand_name ?? 'Leader') : 'Competitor average']} />
                <Line type="monotone" dataKey="avg" stroke="hsl(0 0% 70%)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={!reduced} connectNulls />
                {leader && <Line type="monotone" dataKey="leader" stroke="hsl(0 0% 30%)" strokeWidth={1.5} dot={false} isAnimationActive={!reduced} connectNulls />}
                <Line type="monotone" dataKey="you" stroke={def.color} strokeWidth={3} dot={false} isAnimationActive={!reduced} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-12 text-center">Not enough days of data yet.</p>}
        </div>
        <div className="lg:col-span-2">
          <SubLabel>Competitive ladder</SubLabel>
          <ul className="space-y-1">
            {sorted.map((b, n) => (
              <li key={b.brand_id} className="flex items-center gap-2 text-xs px-1.5 py-1" style={b.is_client_brand ? { background: withAlpha(def.color, 0.1) } : undefined}>
                <span className="w-5 text-right text-[10px] text-muted-foreground tabular-nums">{n + 1}</span>
                <span className={cn('w-24 truncate', b.is_client_brand && 'font-bold')}>{b.brand_name}</span>
                <span className="flex-1 h-2 bg-black/[0.06]">
                  <span className="block h-full" style={{ width: `${def.lowerBetter ? (Math.min(...sorted.map(r => num(r[def.field]))) / Math.max(num(b[def.field]), 0.0001)) * 100 : (num(b[def.field]) / max) * 100}%`, background: b.is_client_brand ? def.color : 'rgba(0,0,0,0.22)' }} />
                </span>
                <span className="w-12 text-right tabular-nums font-semibold">{def.fmt(num(b[def.field]))}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
        <Tile label="Now" value={kpi?.current_value != null ? def.fmt(kpi.current_value) : '—'} />
        <Tile label="Previous period" value={kpi?.previous_value != null ? def.fmt(kpi.previous_value) : '—'} />
        <Tile label="Rank" value={rank ? `#${rank} of ${total}` : '—'} />
        <Tile label="Leader" value={leader ? def.fmt(num(leader[def.field])) : '—'} hint={leader?.brand_name} />
      </div>
      <Chips items={insights.slice(0, 4)} color={def.color} />
    </DetailShell>
  );
}

type LadderMetric = 'visibility' | 'share_of_voice' | 'avg_position' | 'sentiment' | 'mention_count';
const LADDER: { key: LadderMetric; label: string; lowerBetter?: boolean; fmt: (n: number) => string }[] = [
  { key: 'visibility', label: 'Visibility', fmt: n => `${(n * 100).toFixed(1)}%` },
  { key: 'share_of_voice', label: 'Share of voice', fmt: n => `${(n * 100).toFixed(1)}%` },
  { key: 'avg_position', label: 'Avg position', lowerBetter: true, fmt: n => n.toFixed(1) },
  { key: 'sentiment', label: 'Sentiment', fmt: n => Math.round(n).toString() },
  { key: 'mention_count', label: 'Mentions', fmt: n => Math.round(n).toLocaleString() },
];

export function AiCompetitiveLadder({ rows, loading, accent }: { rows: BrandRow[]; loading: boolean; accent: string }) {
  const reduced = usePrefersReducedMotion();
  const [metric, setMetric] = useState<LadderMetric>('visibility');
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const m = LADDER.find(x => x.key === metric)!;
  const sorted = useMemo(
    () => arr<BrandRow>(rows).filter(r => r[metric] != null).sort((a, b) => (m.lowerBetter ? num(a[metric]) - num(b[metric]) : num(b[metric]) - num(a[metric]))),
    [rows, metric, m.lowerBetter],
  );
  const own = sorted.find(r => r.is_client_brand) ?? null;
  const vals = sorted.map(r => num(r[metric]));
  const max = Math.max(...vals, 0.0001);
  const min = Math.min(...vals);

  if (loading) return <div className="h-48 bg-muted/50 animate-pulse" />;
  if (!sorted.length) return <p className="text-sm text-muted-foreground text-center py-8">No competitive data for this period.</p>;

  const focus = hover ? sorted.find(r => r.brand_id === hover) ?? null : null;

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Competitive set</h3>
        <div role="group" aria-label="Rank by" className="flex flex-wrap">
          {LADDER.map(x => (
            <button key={x.key} type="button" aria-pressed={metric === x.key} onClick={() => setMetric(x.key)}
              className={cn('px-2.5 py-1 text-[10px] font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2', metric === x.key ? 'text-white relative z-10' : 'border-border text-muted-foreground hover:text-foreground')}
              style={metric === x.key ? { background: accent, borderColor: accent } : undefined}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs mb-3 min-h-[1.25rem]" aria-live="polite">
        {focus && own && focus.brand_id !== own.brand_id
          ? <span><span className="font-bold">{focus.brand_name}</span>{`: ${m.fmt(num(focus[metric]))} against ${own.brand_name}'s ${m.fmt(num(own[metric]))}.`}</span>
          : own ? <span className="text-muted-foreground">{`${own.brand_name} ranks #${sorted.indexOf(own) + 1} of ${sorted.length} on ${m.label.toLowerCase()}. Hover a brand to compare, click for every metric.`}</span> : null}
      </p>
      <ul className="space-y-1" onMouseLeave={() => setHover(null)}>
        {sorted.map((b, n) => {
          const v = num(b[metric]);
          const width = m.lowerBetter ? (Math.max(min, 0.0001) / Math.max(v, 0.0001)) * 100 : (v / max) * 100;
          const isOpen = open === b.brand_id;
          return (
            <li key={b.brand_id}>
              <button type="button" aria-expanded={isOpen} onMouseEnter={() => setHover(b.brand_id)} onClick={() => setOpen(p => (p === b.brand_id ? null : b.brand_id))}
                className="w-full flex items-center gap-3 px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2"
                style={{ background: b.is_client_brand ? withAlpha(accent, 0.08) : hover === b.brand_id ? 'rgba(0,0,0,0.03)' : undefined, opacity: hover && hover !== b.brand_id && !b.is_client_brand ? 0.6 : 1 }}>
                <span className="w-5 text-right font-mono-ui text-[10px] text-muted-foreground tabular-nums">{n + 1}</span>
                <span className={cn('w-36 truncate text-[12px]', b.is_client_brand && 'font-bold')}>{b.brand_name}</span>
                <span className="flex-1 h-3 bg-black/[0.05]">
                  <span className="block h-full" style={{ width: `${width}%`, background: b.is_client_brand ? `linear-gradient(90deg, ${withAlpha(accent, 0.7)}, ${accent})` : 'rgba(0,0,0,0.22)', transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
                </span>
                <span className={cn('w-16 text-right tabular-nums text-[12px]', b.is_client_brand && 'font-bold')}>{m.fmt(v)}</span>
              </button>
              {isOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-9 py-3 animate-in fade-in slide-in-from-top-1 duration-200" style={{ background: 'rgba(0,0,0,0.025)' }}>
                  {LADDER.map(x => {
                    const theirs = b[x.key];
                    const mine = own ? own[x.key] : null;
                    const better = theirs != null && mine != null && !b.is_client_brand ? (x.lowerBetter ? num(theirs) < num(mine) : num(theirs) > num(mine)) : null;
                    return (
                      <div key={x.key}>
                        <p className="font-mono-ui text-[9px] tracking-[0.14em] uppercase text-muted-foreground">{x.label}</p>
                        <p className="font-display text-lg font-bold tabular-nums">{theirs != null ? x.fmt(num(theirs)) : '—'}</p>
                        {better != null && <p className={cn('text-[10px]', better ? 'text-red-700' : 'text-emerald-700')}>{better ? 'ahead of you' : 'behind you'}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AiKpiCards;
