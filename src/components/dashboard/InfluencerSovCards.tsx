/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Medal, PieChart, Repeat, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Sparkline from './Sparkline';
import {
  Chips, CountUp, DeltaChip, DetailShell, MetricCard, SubLabel, Tile, arr, axisTick, fmt, fmtMoney, hsl,
  insertAfterIndex, num, tooltipStyle, useColumns, useEscape, usePrefersReducedMotion, withAlpha,
} from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Influencer Intelligence: creator share of voice against Kin's industry panel.
 * Four cards (share, rank, creators per month, retention) that open into the comparison behind each:
 * the trend against the leader, the ladder of brands, and where the brand sits against the peer median.
 * ---------------------------------------------------------------------------------------------- */

interface Brand {
  brand: string;
  is_own: boolean;
  emv: number;
  emv_share: number;
  rank: number;
  prior_emv_share: number | null;
  avg_monthly_creators?: number | null;
  retention_pct?: number | null;
  emv_per_creator_month?: number | null;
}

interface Own {
  brand: string;
  emv_share: number;
  rank: number;
  prior_emv_share: number | null;
  delta_pts: number | null;
  brand_count: number;
  avg_monthly_creators?: number | null;
  peer_median_creators?: number | null;
  retention_pct?: number | null;
  peer_median_retention_pct?: number | null;
}

interface Props {
  accent: string;
  own: Own | null;
  brands: Brand[];
  trend: { month: string; shares: Record<string, number> }[];
}

type Key = 'share' | 'rank' | 'creators' | 'retention';

const ICONS: Record<Key, LucideIcon> = { share: PieChart, rank: Medal, creators: Users, retention: Repeat };
const GOLD = 'hsl(40 70% 40%)';

const monthShort = (s: string): string => {
  const [y, m] = String(s).slice(0, 7).split('-').map(Number);
  if (!y || !m) return s;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Own value as a bar with the peer median marked, so the gap reads at a glance. */
function Gauge({ value, peer, color, suffix = '' }: { value: number; peer: number | null; color: string; suffix?: string }) {
  const reduced = usePrefersReducedMotion();
  const max = Math.max(value, peer ?? 0, 1) * 1.15;
  return (
    <div className="mt-2.5">
      <div className="relative h-1.5 bg-black/[0.07]">
        <div className="absolute inset-y-0 left-0" style={{ width: `${(value / max) * 100}%`, background: color, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
        {peer != null && (
          <span className="absolute -top-1 -bottom-1 w-0.5 bg-black/70" style={{ left: `${(peer / max) * 100}%` }} title={`Peer median ${peer}${suffix}`} />
        )}
      </div>
    </div>
  );
}

const InfluencerSovCards = ({ accent, own, brands, trend }: Props) => {
  const reduced = usePrefersReducedMotion();
  const cols = useColumns({ base: 2, md: 4 });
  const [selected, setSelected] = useState<Key | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

  const sorted = useMemo(() => [...arr<Brand>(brands)].sort((a, b) => a.rank - b.rank), [brands]);
  const ownRow = useMemo(() => sorted.find(b => b.is_own) ?? null, [sorted]);
  const ownTrend = useMemo(
    () => (own ? arr<{ month: string; shares: Record<string, number> }>(trend).map(t => num(t.shares?.[own.brand])) : []),
    [own, trend],
  );

  if (!own) return null;

  const keys: Key[] = ['share', 'rank', 'creators', 'retention'];
  const selectedIdx = selected ? keys.indexOf(selected) : -1;
  const after = insertAfterIndex(selectedIdx, cols, keys.length);
  const toggle = (k: Key) => setSelected(prev => (prev === k ? null : k));

  const colorOf: Record<Key, string> = { share: accent, rank: GOLD, creators: hsl(190, 72, 34), retention: hsl(165, 62, 32) };
  const labelOf: Record<Key, string> = { share: `${own.brand} share`, rank: 'Rank', creators: 'Creators / month', retention: 'Creator retention' };
  const maxShare = Math.max(...sorted.map(b => num(b.emv_share)), 0.0001);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {keys.map((k, i) => {
        const color = colorOf[k];
        return (
          <div key={k} className="contents">
            <MetricCard
              color={color}
              icon={ICONS[k]}
              label={labelOf[k]}
              active={selected === k}
              onClick={() => toggle(k)}
              controls="influencer-sov-detail"
              delta={k === 'share' ? <DeltaChip pct={own.delta_pts} suffix="pts" title="Change in share against the prior period" /> : undefined}
            >
              {k === 'share' && (
                <>
                  <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3" style={{ color }}>
                    <CountUp value={num(own.emv_share)} format={n => `${n.toFixed(1)}%`} />
                  </p>
                  <div className="mt-3"><Sparkline values={ownTrend} color={color} width={120} height={28} /></div>
                </>
              )}
              {k === 'rank' && (
                <>
                  <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3">
                    #{own.rank} <span className="text-base font-normal text-muted-foreground">of {own.brand_count}</span>
                  </p>
                  <div className="mt-3 flex items-end gap-1 h-7" aria-hidden>
                    {sorted.map(b => (
                      <span
                        key={b.brand}
                        className="flex-1"
                        title={`${b.rank}. ${b.brand}: ${b.emv_share}%`}
                        style={{
                          height: `${Math.max(14, (num(b.emv_share) / maxShare) * 100)}%`,
                          background: b.is_own ? color : 'rgba(0,0,0,0.16)',
                          transition: reduced ? undefined : 'height 700ms cubic-bezier(0.22,1,0.36,1)',
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
              {k === 'creators' && (
                <>
                  <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3">
                    {own.avg_monthly_creators != null ? <CountUp value={num(own.avg_monthly_creators)} format={fmt} /> : '-'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{own.peer_median_creators != null ? `Peer median ${fmt(num(own.peer_median_creators))}` : 'No peer median'}</p>
                  {own.avg_monthly_creators != null && <Gauge value={num(own.avg_monthly_creators)} peer={own.peer_median_creators != null ? num(own.peer_median_creators) : null} color={color} />}
                </>
              )}
              {k === 'retention' && (
                <>
                  <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3">
                    {own.retention_pct != null ? <CountUp value={num(own.retention_pct)} format={n => `${n.toFixed(1)}%`} /> : '-'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{own.peer_median_retention_pct != null ? `Peer median ${own.peer_median_retention_pct}%` : 'No peer median'}</p>
                  {own.retention_pct != null && <Gauge value={num(own.retention_pct)} peer={own.peer_median_retention_pct != null ? num(own.peer_median_retention_pct) : null} color={color} suffix="%" />}
                </>
              )}
            </MetricCard>

            {i === after && selected && (
              <SovDetail
                kind={selected}
                color={colorOf[selected]}
                accent={accent}
                own={own}
                ownRow={ownRow}
                sorted={sorted}
                trend={arr(trend)}
                reduced={reduced}
                onClose={close}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

function SovDetail({ kind, color, accent, own, ownRow, sorted, trend, reduced, onClose }: {
  kind: Key; color: string; accent: string; own: Own; ownRow: Brand | null; sorted: Brand[];
  trend: { month: string; shares: Record<string, number> }[]; reduced: boolean; onClose: () => void;
}) {
  const leader = sorted[0] ?? null;
  const above = sorted.find(b => b.rank === own.rank - 1) ?? null;
  const below = sorted.find(b => b.rank === own.rank + 1) ?? null;
  const ownShare = num(own.emv_share);
  const gapLeader = leader && !leader.is_own ? num(leader.emv_share) - ownShare : null;
  const gapAbove = above ? num(above.emv_share) - ownShare : null;
  const cushion = below ? ownShare - num(below.emv_share) : null;

  const insights: string[] = [];
  let body: JSX.Element;
  let value = '';
  let sub: string | undefined;
  let blurb = '';

  if (kind === 'share') {
    value = `${ownShare.toFixed(1)}%`;
    sub = own.delta_pts != null ? `${own.delta_pts > 0 ? '+' : ''}${own.delta_pts} pts vs prior period` : undefined;
    blurb = `The slice of all creator EMV across Kin's industry panel that belongs to ${own.brand}. It rises when your creators outperform the category, not just when you post more.`;
    const lines = [{ key: own.brand, color: accent, w: 3 }];
    if (leader && !leader.is_own) lines.push({ key: leader.brand, color: 'hsl(0 0% 25%)', w: 1.5 });
    if (above && above.brand !== leader?.brand) lines.push({ key: above.brand, color: GOLD, w: 1.5 });
    const data = trend.map(t => {
      const row: Record<string, any> = { month: t.month };
      lines.forEach(l => { row[l.key] = num(t.shares?.[l.key]); });
      return row;
    });
    if (gapLeader != null && leader) insights.push(`${leader.brand} leads with ${num(leader.emv_share).toFixed(1)}%, ${gapLeader.toFixed(1)} points ahead of you.`);
    if (gapAbove != null && above) insights.push(`${gapAbove.toFixed(1)} points separate you from ${above.brand} at #${above.rank}.`);
    if (cushion != null && below) insights.push(`You are ${cushion.toFixed(1)} points clear of ${below.brand} at #${below.rank}.`);
    if (ownRow && ownRow.prior_emv_share != null) insights.push(`Prior period share was ${num(ownRow.prior_emv_share).toFixed(1)}%.`);
    const first = data.length ? num(data[0][own.brand]) : 0;
    const lastV = data.length ? num(data[data.length - 1][own.brand]) : 0;
    if (data.length >= 3 && first > 0) {
      const d = lastV - first;
      if (Math.abs(d) >= 0.5) insights.push(`Share is ${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(1)} points since ${monthShort(data[0].month)}.`);
    }
    body = (
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>Share of creator EMV by month</SubLabel>
          {data.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthShort} tick={axisTick} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
                <Tooltip {...tooltipStyle} labelFormatter={(l: string) => monthShort(String(l))} formatter={(v: number, n: string) => [`${v}%`, n]} />
                {lines.map(l => (
                  <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={l.w} dot={false} isAnimationActive={!reduced} animationDuration={700} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-12 text-center">Not enough months of panel data yet to draw a trend.</p>}
          <div className="flex flex-wrap gap-4 mt-2">
            {lines.map(l => (
              <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-3 h-0.5 inline-block" style={{ background: l.color, height: l.w + 1 }} />{l.key}
              </span>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
          <Tile label="Share now" value={`${ownShare.toFixed(1)}%`} />
          <Tile label="Prior period" value={ownRow?.prior_emv_share != null ? `${num(ownRow.prior_emv_share).toFixed(1)}%` : '-'} />
          <Tile label="Gap to #1" value={gapLeader != null ? `${gapLeader.toFixed(1)} pts` : 'You lead'} />
          <Tile label={above ? `Gap to #${above.rank}` : 'Gap above'} value={gapAbove != null ? `${gapAbove.toFixed(1)} pts` : '-'} hint={above?.brand} />
        </div>
      </div>
    );
  } else if (kind === 'rank') {
    value = `#${own.rank} of ${own.brand_count}`;
    blurb = 'Where the brand sits among the brands in the panel, ranked by share of creator EMV. Bars show each brand\u2019s share.';
    const max = Math.max(...sorted.map(b => num(b.emv_share)), 0.0001);
    if (above && gapAbove != null) insights.push(`Overtaking ${above.brand} at #${above.rank} means gaining ${gapAbove.toFixed(1)} points of share.`);
    if (below && cushion != null) insights.push(`${below.brand} sits ${cushion.toFixed(1)} points behind you.`);
    if (leader && !leader.is_own && ownShare > 0) insights.push(`${leader.brand} holds ${(num(leader.emv_share) / ownShare).toFixed(1)}x your share.`);
    body = (
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>Ladder by share of creator EMV</SubLabel>
          <ul className="space-y-1.5">
            {sorted.map(b => (
              <li key={b.brand} className="flex items-center gap-3" style={b.is_own ? { background: withAlpha(color, 0.1) } : undefined}>
                <span className="w-5 text-right font-mono-ui text-[10px] text-muted-foreground tabular-nums">{b.rank}</span>
                <span className={`w-28 shrink-0 truncate text-sm ${b.is_own ? 'font-bold' : ''}`}>{b.brand}</span>
                <span className="flex-1 h-2.5 bg-black/[0.06]">
                  <span className="block h-full" style={{ width: `${(num(b.emv_share) / max) * 100}%`, background: b.is_own ? color : 'rgba(0,0,0,0.25)', transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
                </span>
                <span className="w-12 text-right text-xs tabular-nums">{num(b.emv_share).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
          <Tile label="Your share" value={`${ownShare.toFixed(1)}%`} />
          <Tile label="Brands in panel" value={String(own.brand_count)} />
          <Tile label={above ? `To pass #${above.rank}` : 'To pass #1'} value={gapAbove != null ? `${gapAbove.toFixed(1)} pts` : 'You lead'} hint={above?.brand} />
          <Tile label="Cushion below" value={cushion != null ? `${cushion.toFixed(1)} pts` : '-'} hint={below?.brand} />
        </div>
      </div>
    );
  } else {
    const isCreators = kind === 'creators';
    const own_v = isCreators ? own.avg_monthly_creators : own.retention_pct;
    const peer = isCreators ? own.peer_median_creators : own.peer_median_retention_pct;
    const fmtV = (n: number) => (isCreators ? fmt(n) : `${n.toFixed(1)}%`);
    value = own_v != null ? fmtV(num(own_v)) : '-';
    sub = peer != null ? `Peer median ${fmtV(num(peer))}` : undefined;
    blurb = isCreators
      ? 'How many different creators the brand works with in an average month, against the other brands in the panel. More creators means a wider net.'
      : 'The share of creators who keep working with the brand from one quarter to the next, as calculated by Kin. Higher retention means relationships that compound.';
    const rows = sorted
      .map(b => ({ brand: b.brand, own: b.is_own, v: isCreators ? b.avg_monthly_creators : b.retention_pct }))
      .filter(r => r.v != null)
      .map(r => ({ ...r, v: num(r.v) }))
      .sort((a, b) => b.v - a.v);
    if (own_v != null && peer != null && num(peer) > 0) {
      const diff = num(own_v) - num(peer);
      insights.push(isCreators
        ? `You work with ${Math.round((num(own_v) / num(peer)) * 100)}% as many creators a month as the peer median.`
        : `Retention is ${Math.abs(diff).toFixed(1)} points ${diff >= 0 ? 'above' : 'below'} the peer median.`);
    }
    if (rows.length) {
      const best = rows[0];
      if (!best.own) insights.push(`Best in the set: ${best.brand}, ${fmtV(best.v)}.`);
      const pos = rows.findIndex(r => r.own);
      if (pos >= 0) insights.push(`That ranks ${pos + 1} of ${rows.length} brands on this measure.`);
    }
    const peers = sorted.filter(b => !b.is_own && b.emv_per_creator_month != null).map(b => num(b.emv_per_creator_month));
    const peerMedEpc = median(peers);
    if (isCreators && ownRow?.emv_per_creator_month != null && peerMedEpc) {
      insights.push(`Each creator earns ${fmtMoney(num(ownRow.emv_per_creator_month))} a month, against a peer median of ${fmtMoney(peerMedEpc)}.`);
    }
    body = (
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>{isCreators ? 'Creators per month by brand' : 'Creator retention by brand'}</SubLabel>
          {rows.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="brand" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
                <YAxis tickFormatter={(v: number) => (isCreators ? fmt(v) : `${v}%`)} tick={axisTick} axisLine={false} tickLine={false} width={44} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [fmtV(num(v)), isCreators ? 'Creators / month' : 'Retention']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                {peer != null && <ReferenceLine y={num(peer)} stroke="rgba(0,0,0,0.6)" strokeDasharray="4 4" label={{ value: 'Peer median', position: 'insideTopRight', fontSize: 10, fill: 'rgba(0,0,0,0.6)' }} />}
                <Bar dataKey="v" radius={[2, 2, 0, 0]} isAnimationActive={!reduced} animationDuration={700}>
                  {rows.map(r => <Cell key={r.brand} fill={r.own ? color : 'rgba(0,0,0,0.2)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-12 text-center">No brand-level figures available for this measure yet.</p>}
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
          <Tile label="You" value={own_v != null ? fmtV(num(own_v)) : '-'} />
          <Tile label="Peer median" value={peer != null ? fmtV(num(peer)) : '-'} />
          {isCreators && ownRow?.emv_per_creator_month != null && <Tile label="EMV per creator / month" value={fmtMoney(num(ownRow.emv_per_creator_month))} hint={peerMedEpc ? `Peer median ${fmtMoney(peerMedEpc)}` : undefined} />}
          {rows.length > 0 && <Tile label="Best in set" value={fmtV(rows[0].v)} hint={rows[0].brand} />}
        </div>
      </div>
    );
  }

  return (
    <DetailShell id="influencer-sov-detail" color={color} icon={ICONS[kind]} label={kind === 'share' ? `${own.brand} share` : kind === 'rank' ? 'Rank' : kind === 'creators' ? 'Creators / month' : 'Creator retention'} value={value} sub={sub} blurb={blurb} onClose={onClose}>
      {body}
      <Chips items={insights.slice(0, 4)} color={color} />
    </DetailShell>
  );
}

export default InfluencerSovCards;
