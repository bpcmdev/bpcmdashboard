import { useCallback, useMemo, useState } from 'react';
import { BadgeCheck, DollarSign, Globe, Instagram, Music2, Target, Twitter, UserPlus, Youtube } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Chips, CountUp, DetailShell, MetricCard, SubLabel, Tile, arr, fmt, fmtMoney, hsl, insertAfterIndex, num,
  useColumns, useEscape, usePrefersReducedMotion,
} from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Influencer Intelligence: inbound creator discovery.
 * Creators who talk about the brand without being paid. Four cards that open into who they are, how much
 * value they create, and which of them are not yet working with the brand (the outreach list).
 * ---------------------------------------------------------------------------------------------- */

interface Summary {
  inbound_creators: number | null;
  activated_creators: number | null;
  inbound_miv: number | null;
  tracked_not_activated?: number | null;
  activation_source?: 'kin' | 'lefty' | null;
}

interface Creator {
  voice_name: string | null;
  source_handle: string | null;
  voice_type: string | null;
  channel: string | null;
  mentions: number | null;
  total_reach: number | null;
  total_miv: number | null;
  in_lefty: boolean | null;
  latest_post: string | null;
}

interface Props {
  accent: string;
  summary: Summary;
  creators: Creator[];
  platform: string;
}

type Key = 'inbound' | 'activated' | 'miv' | 'untapped';

const ICONS: Record<Key, LucideIcon> = { inbound: UserPlus, activated: BadgeCheck, miv: DollarSign, untapped: Target };

const channelIcon = (channel: string | null): { Icon: LucideIcon; color: string; label: string } => {
  const c = (channel ?? '').toLowerCase();
  if (c.includes('instagram')) return { Icon: Instagram, color: '#C13584', label: 'Instagram' };
  if (c.includes('tiktok')) return { Icon: Music2, color: '#111111', label: 'TikTok' };
  if (c.includes('youtube')) return { Icon: Youtube, color: '#FF0000', label: 'YouTube' };
  if (c.includes('twitter') || c === 'x') return { Icon: Twitter, color: '#444444', label: 'X' };
  return { Icon: Globe, color: '#888888', label: channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : 'Other' };
};

const titleCase = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Unknown');

const relative = (v: string | null): string => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 31) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`;
};

function Bars({ rows, color, reduced }: { rows: { label: string; v: number; right?: string }[]; color: string; reduced: boolean }) {
  const max = Math.max(...rows.map(r => r.v), 1);
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span className="font-semibold truncate pr-2">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">{r.right ?? fmt(r.v)}</span>
          </div>
          <div className="h-2 bg-black/[0.06]">
            <div className="h-full" style={{ width: `${(r.v / max) * 100}%`, background: color, transition: reduced ? undefined : 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const InfluencerInboundCards = ({ accent, summary, creators, platform }: Props) => {
  const reduced = usePrefersReducedMotion();
  const isKin = summary.activation_source === 'kin';
  const keys: Key[] = isKin ? ['inbound', 'activated', 'miv', 'untapped'] : ['inbound', 'activated', 'miv'];
  const cols = useColumns({ base: 2, md: keys.length });
  const [selected, setSelected] = useState<Key | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEscape(selected != null, close);

  const selectedIdx = selected ? keys.indexOf(selected) : -1;
  const after = insertAfterIndex(selectedIdx, cols, keys.length);

  const list = useMemo(() => arr<Creator>(creators), [creators]);
  const colorOf: Record<Key, string> = { inbound: accent, activated: hsl(165, 62, 32), miv: 'hsl(40 70% 40%)', untapped: hsl(268, 55, 48) };
  const labelOf: Record<Key, string> = {
    inbound: 'Inbound creators',
    activated: `Activated in ${platform}`,
    miv: 'Inbound MIV',
    untapped: `Tracked in ${platform}, not activated`,
  };
  const valueOf: Record<Key, number> = {
    inbound: num(summary.inbound_creators),
    activated: num(summary.activated_creators),
    miv: num(summary.inbound_miv),
    untapped: num(summary.tracked_not_activated),
  };
  const subOf: Record<Key, string> = {
    inbound: 'talking about you, unpaid',
    activated: 'already in your roster',
    miv: 'value from unpaid mentions',
    untapped: 'ready to activate',
  };

  const toggle = (k: Key) => setSelected(prev => (prev === k ? null : k));

  return (
    <div className={`grid grid-cols-2 gap-4 mb-6 ${keys.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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
              controls="influencer-inbound-detail"
            >
              <p className="font-display text-3xl font-bold tabular-nums leading-none mt-3" style={k === 'miv' ? { color } : undefined}>
                <CountUp value={valueOf[k]} format={k === 'miv' ? fmtMoney : fmt} />
              </p>
              <p className="text-[11px] text-muted-foreground mt-1.5">{subOf[k]}</p>
            </MetricCard>

            {i === after && selected && (
              <InboundDetail
                kind={selected}
                color={colorOf[selected]}
                label={labelOf[selected]}
                summary={summary}
                creators={list}
                platform={platform}
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

function InboundDetail({ kind, color, label, summary, creators, platform, reduced, onClose }: {
  kind: Key; color: string; label: string; summary: Summary; creators: Creator[]; platform: string; reduced: boolean; onClose: () => void;
}) {
  const sample = creators.length;
  const sampleMiv = creators.reduce((s, c) => s + num(c.total_miv), 0);
  const totalMiv = num(summary.inbound_miv);
  const byMiv = [...creators].sort((a, b) => num(b.total_miv) - num(a.total_miv));
  const activated = creators.filter(c => c.in_lefty);
  const untapped = byMiv.filter(c => !c.in_lefty);
  const activatedMiv = activated.reduce((s, c) => s + num(c.total_miv), 0);

  const insights: string[] = [];
  let body: JSX.Element;
  let value = '';
  let blurb = '';

  if (kind === 'inbound') {
    value = fmt(num(summary.inbound_creators));
    blurb = 'Creators who have mentioned the brand outside your activated campaigns. They chose to talk about you without being briefed or paid.';
    const types = new Map<string, number>();
    const channels = new Map<string, { n: number; label: string }>();
    creators.forEach(c => {
      const t = titleCase(c.voice_type);
      types.set(t, (types.get(t) ?? 0) + 1);
      const ch = channelIcon(c.channel);
      channels.set(ch.label, { n: (channels.get(ch.label)?.n ?? 0) + 1, label: ch.label });
    });
    const typeRows = [...types.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
    const chanRows = [...channels.values()].map(c => ({ label: c.label, v: c.n })).sort((a, b) => b.v - a.v);
    if (typeRows.length) insights.push(`${typeRows[0].label} voices make up ${Math.round((typeRows[0].v / Math.max(1, sample)) * 100)}% of your top ${sample} inbound creators.`);
    if (chanRows.length) insights.push(`${chanRows[0].label} is where most of them post (${chanRows[0].v} of ${sample}).`);
    const top = byMiv[0];
    if (top?.voice_name) insights.push(`Biggest voice: ${top.voice_name}, ${fmtMoney(num(top.total_miv))} of value.`);
    body = (
      <div className="grid gap-6 lg:grid-cols-2 mt-5">
        <div><SubLabel>{`Who they are (top ${sample} by value)`}</SubLabel><Bars rows={typeRows} color={color} reduced={reduced} /></div>
        <div><SubLabel>{`Where they post (top ${sample} by value)`}</SubLabel><Bars rows={chanRows} color={color} reduced={reduced} /></div>
      </div>
    );
  } else if (kind === 'activated') {
    value = fmt(num(summary.activated_creators));
    blurb = `Inbound creators who are also activated in ${platform}, so their posts are tracked as part of your programme.`;
    const miss = sample - activated.length;
    if (sample) insights.push(`${activated.length} of your top ${sample} inbound creators are already activated.`);
    if (sampleMiv > 0 && activatedMiv > 0) insights.push(`They carry ${Math.round((activatedMiv / sampleMiv) * 100)}% of the value in that group.`);
    if (miss > 0) insights.push(`${miss} high-value creators are talking about you without being activated yet.`);
    body = (
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>{`Activated vs not, among your top ${sample} inbound creators`}</SubLabel>
          <div className="flex h-8 w-full overflow-hidden border border-black/10">
            <div className="flex items-center justify-center font-mono-ui text-[10px] text-white" style={{ width: `${sample ? (activated.length / sample) * 100 : 0}%`, background: color }}>
              {activated.length > 0 ? `${activated.length} activated` : ''}
            </div>
            <div className="flex items-center justify-center font-mono-ui text-[10px] text-black/60" style={{ width: `${sample ? (miss / sample) * 100 : 0}%`, background: 'rgba(0,0,0,0.08)' }}>
              {miss > 0 ? `${miss} not yet` : ''}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Based on the {sample} highest-value inbound creators shown in the table below.</p>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
          <Tile label={`Activated in ${platform}`} value={fmt(num(summary.activated_creators))} />
          <Tile label="Inbound creators" value={fmt(num(summary.inbound_creators))} />
        </div>
      </div>
    );
  } else if (kind === 'miv') {
    value = fmtMoney(totalMiv);
    blurb = 'Media impact value: the estimated worth of what these creators posted about the brand without being paid. It is free exposure with a price tag attached.';
    const top5 = byMiv.slice(0, 5).reduce((s, c) => s + num(c.total_miv), 0);
    if (totalMiv > 0 && top5 > 0) insights.push(`Your top 5 inbound creators account for ${Math.round((top5 / totalMiv) * 100)}% of all inbound value.`);
    if (byMiv[0]?.voice_name) insights.push(`${byMiv[0].voice_name} alone is worth ${fmtMoney(num(byMiv[0].total_miv))}.`);
    const mentions = creators.reduce((s, c) => s + num(c.mentions), 0);
    if (mentions > 0 && sampleMiv > 0) insights.push(`Each mention from these creators is worth about ${fmtMoney(sampleMiv / mentions)}.`);
    const rows = byMiv.slice(0, 8).map(c => ({ label: c.voice_name || c.source_handle || 'Creator', v: num(c.total_miv), right: fmtMoney(num(c.total_miv)) })).filter(r => r.v > 0);
    body = (
      <div className="grid gap-6 lg:grid-cols-5 mt-5">
        <div className="lg:col-span-3">
          <SubLabel>Most valuable inbound creators</SubLabel>
          {rows.length ? <Bars rows={rows} color={color} reduced={reduced} /> : <p className="text-sm text-muted-foreground">No creator-level value to show yet.</p>}
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
          <Tile label="Inbound MIV" value={fmtMoney(totalMiv)} />
          <Tile label="Creators" value={fmt(num(summary.inbound_creators))} />
          {num(summary.inbound_creators) > 0 && <Tile label="Value per creator" value={fmtMoney(totalMiv / num(summary.inbound_creators))} hint="Average across all inbound creators" />}
        </div>
      </div>
    );
  } else {
    value = fmt(num(summary.tracked_not_activated));
    blurb = `Creators ${platform} is tracking who have not been activated yet. They already know the brand, which makes them the warmest outreach list you have.`;
    const top = untapped.slice(0, 5);
    const topMiv = top.reduce((s, c) => s + num(c.total_miv), 0);
    if (top.length && topMiv > 0) insights.push(`The ${top.length} biggest creators below carry ${fmtMoney(topMiv)} of value you are not working with yet.`);
    if (top[0]?.voice_name) insights.push(`Start with ${top[0].voice_name}: ${fmtMoney(num(top[0].total_miv))} across ${num(top[0].mentions)} mention${num(top[0].mentions) === 1 ? '' : 's'}.`);
    body = (
      <div className="mt-5">
        <SubLabel>Biggest creators not yet activated (from your top inbound list)</SubLabel>
        {top.length ? (
          <ul className="divide-y divide-black/[0.08]">
            {top.map((c, i) => {
              const ch = channelIcon(c.channel);
              return (
                <li key={`${c.voice_name}-${i}`} className="py-2.5 flex items-center gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-bold text-white" style={{ background: color }}>{i + 1}</span>
                  <span className="shrink-0" title={ch.label} style={{ color: ch.color }}><ch.Icon className="w-4 h-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{c.voice_name || c.source_handle || 'Creator'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{[c.source_handle, titleCase(c.voice_type)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="hidden sm:block text-[11px] text-muted-foreground tabular-nums">{num(c.mentions)} mention{num(c.mentions) === 1 ? '' : 's'}</span>
                  <span className="hidden sm:block text-[11px] text-muted-foreground tabular-nums w-16 text-right">{fmt(num(c.total_reach))} reach</span>
                  <span className="font-display text-lg font-bold tabular-nums w-16 text-right" style={{ color }}>{fmtMoney(num(c.total_miv))}</span>
                  <span className="hidden md:block text-[11px] text-muted-foreground w-14 text-right">{relative(c.latest_post)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Everyone in your top inbound list is already activated.</p>
        )}
      </div>
    );
  }

  return (
    <DetailShell id="influencer-inbound-detail" color={color} icon={ICONS[kind]} label={label} value={value} blurb={blurb} onClose={onClose}>
      {body}
      <Chips items={insights.slice(0, 4)} color={color} />
    </DetailShell>
  );
}

export default InfluencerInboundCards;
