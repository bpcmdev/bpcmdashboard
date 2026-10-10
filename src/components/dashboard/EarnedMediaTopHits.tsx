/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ExternalLink, Globe, Image as ImageIcon, Instagram, Music2, Twitter, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chips, arr, fmt, fmtMoney, num, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Earned Media: the standout hits. Top press and top social as ranked, sortable cards with reach bars,
 * value, tier and channel badges, and a short read-out of what the list adds up to.
 * Note: press rows come back as outlet_name / outlet_tier (older rows used outlet / tier), so both are read.
 * ---------------------------------------------------------------------------------------------- */

const PRESS = 'hsl(226 67% 33%)';
const SOCIAL = 'hsl(42 64% 45%)';
const TIER_COLOR: Record<number, string> = { 1: 'hsl(226 67% 33%)', 2: 'hsl(42 64% 45%)', 3: 'hsl(0 0% 58%)' };

const tierName = (t: number | null) => (t ? `Tier ${t}` : 'Unrated');
const tierBadge = (t: number | null) => (t === 1 ? 'bg-tier1' : t === 2 ? 'bg-tier2' : t === 3 ? 'bg-tier3' : 'bg-muted text-muted-foreground');

const dayLabel = (d: string | null | undefined) => {
  if (!d) return '';
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const channelMeta = (c: string | null | undefined): { label: string; icon: LucideIcon; color: string } => {
  const v = (c ?? '').toLowerCase();
  if (v.includes('instagram')) return { label: 'Instagram', icon: Instagram, color: 'hsl(330 65% 48%)' };
  if (v.includes('tiktok')) return { label: 'TikTok', icon: Music2, color: 'hsl(174 62% 30%)' };
  if (v.includes('youtube')) return { label: 'YouTube', icon: Youtube, color: 'hsl(0 72% 46%)' };
  if (v.includes('twitter') || v === 'x') return { label: 'X', icon: Twitter, color: 'hsl(0 0% 20%)' };
  if (v.includes('facebook')) return { label: 'Facebook', icon: Globe, color: 'hsl(214 80% 48%)' };
  return { label: c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Social', icon: Globe, color: 'hsl(0 0% 50%)' };
};

const engRate = (r: unknown): number | null => {
  if (r == null || r === '') return null;
  const n = num(r);
  return n <= 1 ? n * 100 : n;
};

function SortToggle<T extends string>({ value, options, onChange, color }: { value: T; options: [T, string][]; onChange: (v: T) => void; color: string }) {
  return (
    <div role="group" aria-label="Sort by" className="flex">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'px-2.5 py-1 text-[10px] font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2',
            value === v ? 'text-white relative z-10' : 'border-border text-muted-foreground hover:text-foreground',
          )}
          style={value === v ? { background: color, borderColor: color } : undefined}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const EarnedMediaTopHits = ({ topPress, topSocial }: { topPress: any[]; topSocial: any[] }) => {
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(false);
  const [pressSort, setPressSort] = useState<'reach' | 'value'>('reach');
  const [socialSort, setSocialSort] = useState<'reach' | 'value' | 'eng'>('reach');

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const press = useMemo(() => {
    const rows = arr<any>(topPress).map((p, i) => ({
      key: String(p.id ?? `${p.headline}-${i}`),
      headline: String(p.headline ?? 'Untitled'),
      url: p.url ?? null,
      outlet: p.outlet_name ?? p.outlet ?? null,
      tier: (p.outlet_tier ?? p.tier) == null ? null : num(p.outlet_tier ?? p.tier),
      channel: String(p.channel_type ?? '').toLowerCase(),
      reach: num(p.potential_reach),
      value: num(p.ad_value ?? p.miv),
      date: p.published_at ?? null,
      product: p.product_name ?? null,
      cover: p.print_cover_url ?? null,
      clipping: p.print_clipping_url ?? null,
    }));
    return rows.sort((a, b) => (pressSort === 'reach' ? b.reach - a.reach : b.value - a.value));
  }, [topPress, pressSort]);

  const social = useMemo(() => {
    const rows = arr<any>(topSocial).map((s, i) => ({
      key: String(s.id ?? `${s.voice_name}-${i}`),
      name: String(s.voice_name ?? s.source_handle ?? 'Creator'),
      handle: s.source_handle ?? null,
      url: s.url ?? null,
      channel: s.channel ?? null,
      reach: num(s.potential_reach),
      value: num(s.miv_usd),
      eng: engRate(s.engagement_rate),
      date: s.published_at ?? null,
      bpcm: !!s.in_lefty,
    }));
    return rows.sort((a, b) => (socialSort === 'reach' ? b.reach - a.reach : socialSort === 'value' ? b.value - a.value : num(b.eng) - num(a.eng)));
  }, [topSocial, socialSort]);

  const pressMax = Math.max(...press.map(p => (pressSort === 'reach' ? p.reach : p.value)), 1);
  const socialMax = Math.max(...social.map(s => (socialSort === 'reach' ? s.reach : socialSort === 'value' ? s.value : num(s.eng))), 1);

  const pressInsights: string[] = [];
  const pressReach = press.reduce((s, p) => s + p.reach, 0);
  if (press.length && pressReach) pressInsights.push(`These ${press.length} stories reach a combined ${fmt(pressReach)} potential readers.`);
  const prints = press.filter(p => p.channel.includes('print')).length;
  if (prints) pressInsights.push(`${prints} of them ${prints === 1 ? 'is a print feature' : 'are print features'}.`);
  const unrated = press.filter(p => !p.tier).length;
  if (press.length && unrated === press.length) pressInsights.push('None of these outlets are tiered yet, so their quality rating is still to come.');

  const socialInsights: string[] = [];
  const socialReach = social.reduce((s, r) => s + r.reach, 0);
  if (social.length && socialReach) socialInsights.push(`Combined reach of ${fmt(socialReach)} across ${social.length} posts.`);
  const topEng = [...social].filter(s => s.eng != null).sort((a, b) => num(b.eng) - num(a.eng))[0];
  if (topEng && topEng.eng) socialInsights.push(`Most engaging: ${topEng.name} at ${topEng.eng.toFixed(1)}% engagement.`);
  const chans = new Map<string, number>();
  social.forEach(s => { const c = channelMeta(s.channel).label; chans.set(c, (chans.get(c) ?? 0) + 1); });
  const topChan = [...chans.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topChan && social.length > 1) socialInsights.push(`${topChan[0]} accounts for ${topChan[1]} of the ${social.length} top posts.`);

  const bar = (v: number, max: number, color: string) => (
    <span className="block h-1 w-full bg-black/[0.06] mt-2" aria-hidden>
      <span className="block h-full" style={{ width: drawn || reduced ? `${(v / max) * 100}%` : '0%', background: color, transition: reduced ? undefined : 'width 900ms cubic-bezier(0.22,1,0.36,1)' }} />
    </span>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* ---------- top press ---------- */}
      <div className="section-card border overflow-hidden">
        <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${withAlpha(PRESS, 0.4)}, ${PRESS})` }} />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Top Press</h3>
            {press.length > 1 && <SortToggle<typeof pressSort> value={pressSort} onChange={setPressSort} color={PRESS} options={[['reach', 'Reach'], ['value', 'Value']]} />}
          </div>
          {press.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No press hits in this period.</p>
          ) : (
            <ol className="space-y-2">
              {press.map((p, i) => {
                const tc = p.tier ? TIER_COLOR[p.tier] ?? PRESS : 'hsl(0 0% 75%)';
                return (
                  <li
                    key={p.key}
                    className="group relative flex gap-3 p-3 border border-transparent transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    style={{ background: withAlpha(PRESS, 0.03), borderLeft: `3px solid ${tc}` }}
                  >
                    <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-bold text-white" style={{ background: PRESS }}>{i + 1}</span>
                    {p.cover && (
                      <a href={p.cover} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Open print cover">
                        <img src={p.cover} alt="Print cover" loading="lazy" className="w-10 h-14 object-cover border border-border" />
                      </a>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug line-clamp-2">
                        {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.headline}</a> : p.headline}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {p.outlet && <span className="text-[11px] font-bold">{p.outlet}</span>}
                        <span className={cn('text-[10px] font-bold tracking-wider px-1.5 py-0.5', tierBadge(p.tier))}>{tierName(p.tier).toUpperCase()}</span>
                        {p.channel && <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 border border-border text-muted-foreground">{p.channel.toUpperCase()}</span>}
                        {p.product && <span className="text-[10px] px-1.5 py-0.5" style={{ background: withAlpha(SOCIAL, 0.15), color: 'hsl(42 64% 28%)' }}>{p.product}</span>}
                        <span className="text-[10px] text-muted-foreground">{dayLabel(p.date)}</span>
                        {p.clipping && (
                          <a href={p.clipping} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                            <ImageIcon className="w-3 h-3" aria-hidden /> Clipping
                          </a>
                        )}
                      </div>
                      {bar(pressSort === 'reach' ? p.reach : p.value, pressMax, PRESS)}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold tabular-nums leading-tight" title="Potential reach: outlet audience size reported by Launchmetrics, not article views">{p.reach ? fmt(p.reach) : '-'}</p>
                      <p className="text-[10px] text-muted-foreground">reach</p>
                      {p.value > 0 && <p className="text-[11px] font-semibold tabular-nums mt-1" style={{ color: PRESS }}>{fmtMoney(p.value)}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Chips items={pressInsights.slice(0, 3)} color={PRESS} />
          <p className="text-[10px] text-muted-foreground mt-3">Reach is the outlet&apos;s potential audience reported by Launchmetrics, not article views.</p>
        </div>
      </div>

      {/* ---------- top social ---------- */}
      <div className="section-card border overflow-hidden">
        <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${withAlpha(SOCIAL, 0.4)}, ${SOCIAL})` }} />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Top Social</h3>
            {social.length > 1 && <SortToggle<typeof socialSort> value={socialSort} onChange={setSocialSort} color="hsl(42 64% 38%)" options={[['reach', 'Reach'], ['value', 'Value'], ['eng', 'Engagement']]} />}
          </div>
          {social.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No social mentions in this period.</p>
          ) : (
            <ol className="space-y-2">
              {social.map(s => {
                const ch = channelMeta(s.channel);
                const Icon = ch.icon;
                const engColor = s.eng == null ? null : s.eng >= 10 ? 'hsl(152 55% 30%)' : s.eng >= 4 ? 'hsl(36 80% 35%)' : 'hsl(0 0% 40%)';
                const engBg = s.eng == null ? undefined : s.eng >= 10 ? 'hsl(152 55% 38% / 0.14)' : s.eng >= 4 ? 'hsl(36 90% 50% / 0.15)' : 'hsl(0 0% 94%)';
                const metric = socialSort === 'reach' ? s.reach : socialSort === 'value' ? s.value : num(s.eng);
                return (
                  <li
                    key={s.key}
                    className="group relative flex items-start gap-3 p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    style={{ background: withAlpha(SOCIAL, 0.05), borderLeft: `3px solid ${ch.color}` }}
                  >
                    <span className="relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-display text-sm font-bold text-white" style={{ background: ch.color }}>
                      {s.name.charAt(0).toUpperCase()}
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center" title={ch.label}>
                        <Icon className="w-2.5 h-2.5" style={{ color: ch.color }} aria-hidden />
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                            {s.name}<ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden />
                          </a>
                        ) : s.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {s.handle && <span className="text-[10px] text-muted-foreground truncate">@{String(s.handle).replace(/^@/, '')}</span>}
                        <span className="text-[10px] text-muted-foreground">{ch.label} · {dayLabel(s.date)}</span>
                        {s.bpcm && <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5" style={{ backgroundColor: SOCIAL, color: '#1a1a1a' }}>BPCM CREATOR</span>}
                      </div>
                      {bar(metric, socialMax, ch.color)}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold tabular-nums leading-tight" title="Potential reach reported by Launchmetrics, not views">{s.reach ? fmt(s.reach) : '-'}</p>
                      <p className="text-[10px] text-muted-foreground">reach</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        {s.eng != null && <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5" style={{ background: engBg, color: engColor ?? undefined }}>{s.eng.toFixed(1)}% eng.</span>}
                        {s.value > 0 && <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'hsl(42 64% 32%)' }}>{fmtMoney(s.value)}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Chips items={socialInsights.slice(0, 3)} color={SOCIAL} />
        </div>
      </div>
    </div>
  );
};

export default EarnedMediaTopHits;
