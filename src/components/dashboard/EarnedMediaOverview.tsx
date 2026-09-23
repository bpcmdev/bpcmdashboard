import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { formatMoney, formatCount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Image as ImageIcon, Instagram, Youtube, Music2, Twitter, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESS_COLOR = 'hsl(var(--chart-royal, 226 67% 33%))';
const SOCIAL_COLOR = 'hsl(var(--chart-gold))';

interface Totals {
  total_miv?: number; press_miv?: number; social_miv?: number;
  press_count?: number; distinct_outlets?: number; tier1_count?: number;
  social_count?: number; social_lefty_count?: number;
  social_lefty_miv?: number; social_organic_miv?: number;
}

interface Summary {
  tracked?: boolean;
  period?: { start?: string | null; end?: string | null };
  totals?: Totals;
  prior?: Totals | null;
  tier_mix?: any[];
  press_channel_mix?: any[];
  social_channel_mix?: any[];
  weekly?: any[];
  top_outlets?: any[];
  by_product?: any[];
  top_press?: any[];
  top_social?: any[];
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v: any) => (Array.isArray(v) ? v : []);

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground', className)}>
      {children}
    </span>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}

function tierBadgeClass(tier: number | null | undefined): string {
  if (tier === 1) return 'bg-tier1';
  if (tier === 2) return 'bg-tier2';
  if (tier === 3) return 'bg-tier3';
  return 'bg-muted text-muted-foreground';
}

function tierName(tier: number | null | undefined): string {
  return tier ? `Tier ${tier}` : 'Unrated';
}

function formatReach(val: number | null | undefined): string {
  if (!val) return '—';
  return formatCount(val);
}

function formatDay(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function channelIcon(channel: string | null | undefined) {
  const c = (channel ?? '').toLowerCase();
  if (c.includes('instagram')) return <Instagram className="w-3.5 h-3.5" />;
  if (c.includes('tiktok')) return <Music2 className="w-3.5 h-3.5" />;
  if (c.includes('youtube')) return <Youtube className="w-3.5 h-3.5" />;
  if (c.includes('twitter') || c.includes('x')) return <Twitter className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function channelLabel(channelType: string | null | undefined): string | null {
  const c = (channelType ?? '').toLowerCase();
  if (!c) return null;
  if (c.includes('print')) return 'PRINT';
  if (c.includes('online') || c.includes('web') || c.includes('digital')) return 'ONLINE';
  return c.toUpperCase();
}

/** Delta chip honouring the "New" rule: never a percentage off a zero prior. */
function DeltaChip({ current, prior }: { current: number; prior: number | null | undefined }) {
  if (prior == null) return <span className="text-[10px] text-muted-foreground">—</span>;
  if (prior === 0) {
    if (current === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
    return <span className="text-[10px] font-bold text-emerald-400">New</span>;
  }
  const pct = ((current - prior) / prior) * 100;
  if (!Number.isFinite(pct) || Math.round(pct) === 0) {
    return <span className="text-[10px] text-muted-foreground">Stable</span>;
  }
  const up = pct > 0;
  return (
    <span className={cn('text-[10px] font-bold', up ? 'text-emerald-400' : 'text-red-400')}>
      {up ? '+' : '−'}{Math.abs(Math.round(pct))}% vs prior
    </span>
  );
}

function StatCard({ label, value, current, prior }: { label: string; value: string; current: number; prior: number | null | undefined }) {
  return (
    <div className="section-card border p-4">
      <Label>{label}</Label>
      <p className="font-display text-[28px] leading-none font-bold mt-2 tabular-nums">{value}</p>
      <div className="mt-2"><DeltaChip current={current} prior={prior} /></div>
    </div>
  );
}

const EarnedMediaOverview = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activeClientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(false);
      const params: Record<string, any> = { p_client_id: activeClientId };
      if (!isAllTime && effectiveFrom && effectiveTo) {
        params.p_start = effectiveFrom;
        params.p_end = effectiveTo;
      }
      const { data, error: err } = await supabase.rpc('earned_media_summary_secure' as any, params);
      if (cancelled) return;
      if (err) {
        console.error('earned_media_summary_secure failed:', err);
        setError(true);
        setLoading(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setSummary((row ?? null) as Summary | null);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load earned media. Please try refreshing.</p>;
  }

  if (!summary || summary.tracked === false) {
    return (
      <div className="section-card border p-10 text-center">
        <Label>Earned Media</Label>
        <p className="font-display text-lg mt-3">Earned media not yet tracked for this client</p>
      </div>
    );
  }

  const t = summary.totals ?? {};
  const prior = summary.prior ?? null;
  const totalMiv = num(t.total_miv);
  const pressMiv = num(t.press_miv);
  const socialMiv = num(t.social_miv);
  const mivBase = pressMiv + socialMiv || totalMiv || 1;
  const pressPct = Math.round((pressMiv / mivBase) * 100);
  const socialPct = Math.max(0, 100 - pressPct);

  const weekly = arr(summary.weekly)
    .map((w: any) => ({
      week_start: String(w.week_start ?? '').slice(0, 10),
      week: formatDay(w.week_start),
      press_miv: num(w.press_miv),
      social_miv: num(w.social_miv),
      press_count: num(w.press_count),
      social_count: num(w.social_count),
    }))
    .filter((w) => w.week_start)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  // Monthly press-coverage buckets: sum weekly press_count into calendar months.
  // Only months with actual placements render — no empty months, no prior-year comparison.
  const monthMap = new Map<string, { key: string; label: string; placements: number }>();
  weekly.forEach((w) => {
    const d = new Date(w.week_start + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthMap.get(key) ?? {
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', ' ’'),
      placements: 0,
    };
    entry.placements += w.press_count;
    monthMap.set(key, entry);
  });
  const monthlyCoverage = Array.from(monthMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .filter((m) => m.placements > 0);

  // Trailing 8 weeks of placements — show only what exists, no zero-padding.
  const weekly8 = weekly.slice(-8).map((w) => ({ week: w.week, placements: w.press_count }));
  const showCoverageCharts = weekly.length > 0;

  const tierMix = arr(summary.tier_mix)
    .map((r: any) => ({ tier: num(r.tier), count: num(r.count), miv: num(r.miv) }))
    .sort((a, b) => (a.tier === 0 ? 99 : a.tier) - (b.tier === 0 ? 99 : b.tier));

  const pressChannelMix = arr(summary.press_channel_mix).map((r: any) => ({
    channel: channelLabel(r.channel_type ?? r.channel) ?? 'UNSPECIFIED',
    count: num(r.count),
    miv: num(r.miv),
  }));
  const channelTotal = pressChannelMix.reduce((s, r) => s + r.count, 0);

  const topOutlets = arr(summary.top_outlets);
  const byProduct = arr(summary.by_product);
  const topPress = arr(summary.top_press);
  const topSocial = arr(summary.top_social);
  const leftyCount = num(t.social_lefty_count);

  return (
    <TooltipProvider>
      <div className="space-y-4 md:space-y-6">
        {/* 1 — HERO */}
        <div className="section-card border p-5 md:p-6">
          <Label>Total Media Impact Value</Label>
          <p className="font-display text-[44px] md:text-[56px] leading-none font-bold mt-2 tabular-nums">
            {formatMoney(totalMiv)}
          </p>
          <div className="mt-5">
            <div className="flex h-3 w-full overflow-hidden rounded-sm bg-muted">
              <div style={{ width: `${pressPct}%`, backgroundColor: PRESS_COLOR }} />
              <div style={{ width: `${socialPct}%`, backgroundColor: SOCIAL_COLOR }} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3">
              <span className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PRESS_COLOR }} />
                <Label>Press</Label>
                <span className="font-display font-bold tabular-nums">{formatMoney(pressMiv)}</span>
                <span className="text-muted-foreground">{pressPct}%</span>
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SOCIAL_COLOR }} />
                <Label>Social</Label>
                <span className="font-display font-bold tabular-nums">{formatMoney(socialMiv)}</span>
                <span className="text-muted-foreground">{socialPct}%</span>
              </span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            MIV (Media Impact Value) is Launchmetrics' dollar valuation of earned coverage.
          </p>
        </div>

        {/* 2 — STAT ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Press Placements" value={formatCount(num(t.press_count))} current={num(t.press_count)} prior={prior ? num(prior.press_count) : null} />
          <StatCard label="Outlets" value={formatCount(num(t.distinct_outlets))} current={num(t.distinct_outlets)} prior={prior ? num(prior.distinct_outlets) : null} />
          <StatCard label="Tier 1 Placements" value={formatCount(num(t.tier1_count))} current={num(t.tier1_count)} prior={prior ? num(prior.tier1_count) : null} />
          <StatCard label="Social Mentions" value={formatCount(num(t.social_count))} current={num(t.social_count)} prior={prior ? num(prior.social_count) : null} />
        </div>

        {/* 3 — SOCIAL ATTRIBUTION */}
        {leftyCount > 0 && (
          <div className="section-card border p-5 md:p-6">
            <SectionTitle>Social Attribution</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border-l-2 pl-3" style={{ borderColor: SOCIAL_COLOR }}>
                <Label>Creators BPCM activated</Label>
                <p className="font-display text-2xl font-bold mt-1 tabular-nums">{formatMoney(num(t.social_lefty_miv))}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{formatCount(leftyCount)} mention{leftyCount === 1 ? '' : 's'}</p>
              </div>
              <div className="border-l-2 border-border pl-3">
                <Label>Organic mentions</Label>
                <p className="font-display text-2xl font-bold mt-1 tabular-nums">{formatMoney(num(t.social_organic_miv))}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatCount(Math.max(0, num(t.social_count) - leftyCount))} mentions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3b — COVERAGE VOLUME CHARTS (monthly + trailing 8 weeks) */}
        {showCoverageCharts && (monthlyCoverage.length > 0 || weekly8.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {monthlyCoverage.length > 0 && (
              <div className="section-card border p-5 md:p-6">
                <SectionTitle>Press Coverage — Monthly</SectionTitle>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyCoverage} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        width={40}
                      />
                      <ReTooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                        formatter={(value: any) => [formatCount(num(value)), 'Placements']}
                      />
                      <Bar
                        dataKey="placements"
                        fill={PRESS_COLOR}
                        radius={[2, 2, 0, 0]}
                        animationBegin={80}
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  Press placements grouped by calendar month.
                </p>
              </div>
            )}

            {weekly8.length > 0 && (
              <div className="section-card border p-5 md:p-6">
                <SectionTitle>Placement Volume — 8 Weeks</SectionTitle>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekly8} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        width={40}
                      />
                      <ReTooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                        formatter={(value: any) => [formatCount(num(value)), 'Placements']}
                      />
                      <Bar
                        dataKey="placements"
                        fill={PRESS_COLOR}
                        radius={[2, 2, 0, 0]}
                        animationBegin={120}
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  Placements per week, trailing 8 weeks of available data.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 4 — TREND */}
        <div className="section-card border p-5 md:p-6">
          <SectionTitle>MIV Trend</SectionTitle>
          {weekly.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No weekly coverage in this period.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => formatMoney(v)} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={56} />
                  <ReTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                    formatter={(value: any, name: any, payload: any) => {
                      if (name === 'press_miv') return [`${formatMoney(num(value))} · ${formatCount(num(payload?.payload?.press_count))} placements`, 'Press MIV'];
                      return [`${formatMoney(num(value))} · ${formatCount(num(payload?.payload?.social_count))} mentions`, 'Social MIV'];
                    }}
                  />
                  <Bar dataKey="press_miv" stackId="miv" fill={PRESS_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="social_miv" stackId="miv" fill={SOCIAL_COLOR} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 5 — QUALITY */}
        <div className="section-card border p-5 md:p-6">
          <SectionTitle>Coverage Quality</SectionTitle>
          {tierMix.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No tiered placements in this period.</p>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-4 gap-2 pb-2">
                <Label>Tier</Label>
                <Label className="text-right">Placements</Label>
                <Label className="text-right">MIV</Label>
                <Label className="text-right">Avg MIV</Label>
              </div>
              {tierMix.map((r) => (
                <div key={r.tier} className="grid grid-cols-4 gap-2 py-2 items-center text-xs">
                  <span className={cn('justify-self-start text-[10px] font-bold tracking-wider px-2 py-0.5', tierBadgeClass(r.tier || null))}>
                    {tierName(r.tier || null).toUpperCase()}
                  </span>
                  <span className="text-right tabular-nums">{formatCount(r.count)}</span>
                  <span className="text-right tabular-nums font-display font-bold">{formatMoney(r.miv)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {r.count ? formatMoney(r.miv / r.count) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {pressChannelMix.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <Label>Online vs Print</Label>
              <div className="mt-3 space-y-2">
                {pressChannelMix.map((r) => (
                  <div key={r.channel} className="flex items-center gap-3 text-xs">
                    <span className="w-16 text-[10px] font-bold tracking-wider text-muted-foreground">{r.channel}</span>
                    <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${channelTotal ? (r.count / channelTotal) * 100 : 0}%`, backgroundColor: PRESS_COLOR }}
                      />
                    </div>
                    <span className="tabular-nums w-10 text-right">{formatCount(r.count)}</span>
                    <span className="tabular-nums w-16 text-right font-display font-bold">{formatMoney(r.miv)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 6 — WHAT DROVE IT */}
        <div className={cn('grid gap-4 md:gap-6', byProduct.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
          <div className="section-card border p-5 md:p-6">
            <SectionTitle>Top Outlets</SectionTitle>
            {topOutlets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No outlets in this period.</p>
            ) : (
              <div className="divide-y divide-border">
                {topOutlets.map((o: any, i: number) => (
                  <div key={`${o.outlet}-${i}`} className="flex items-center gap-3 py-2 text-xs">
                    <span className="font-bold flex-1 truncate">{o.outlet ?? '—'}</span>
                    <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5 shrink-0', tierBadgeClass(o.tier))}>
                      {tierName(o.tier).toUpperCase()}
                    </span>
                    <span className="tabular-nums text-muted-foreground w-8 text-right">{formatCount(num(o.count))}</span>
                    <span className="tabular-nums font-display font-bold w-16 text-right">{formatMoney(num(o.miv))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {byProduct.length > 0 && (
            <div className="section-card border p-5 md:p-6">
              <SectionTitle>MIV by Product</SectionTitle>
              <div className="divide-y divide-border">
                {byProduct.map((p: any, i: number) => (
                  <div key={`${p.product}-${i}`} className="flex items-center gap-3 py-2 text-xs">
                    <span className="font-bold flex-1 truncate">{p.product ?? '—'}</span>
                    <span className="tabular-nums text-muted-foreground w-8 text-right">{formatCount(num(p.count))}</span>
                    <span className="tabular-nums font-display font-bold w-16 text-right">{formatMoney(num(p.miv))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 7 — TOP HITS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="section-card border p-5 md:p-6">
            <SectionTitle>Top Press</SectionTitle>
            {topPress.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No press hits in this period.</p>
            ) : (
              <div className="divide-y divide-border">
                {topPress.map((p: any, i: number) => {
                  const chan = channelLabel(p.channel_type);
                  return (
                    <div key={p.id ?? `${p.headline}-${i}`} className="flex gap-3 py-3">
                      {p.print_cover_url && (
                        <a href={p.print_cover_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img src={p.print_cover_url} alt="Print cover" loading="lazy" className="w-10 h-14 object-cover border border-border rounded-sm" />
                        </a>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug">
                          {p.url ? (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.headline}</a>
                          ) : (
                            p.headline
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-[11px] font-bold">{p.outlet}</span>
                          <span className={cn('text-[10px] font-bold tracking-wider px-1.5 py-0.5', tierBadgeClass(p.tier))}>
                            {tierName(p.tier).toUpperCase()}
                          </span>
                          {chan && (
                            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 border border-border text-muted-foreground">{chan}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{formatDay(p.published_at)}</span>
                          {p.print_clipping_url && (
                            <a
                              href={p.print_clipping_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                            >
                              <ImageIcon className="w-3 h-3" />
                              View clipping
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 self-start text-right pt-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground tabular-nums cursor-help">
                              {formatReach(num(p.potential_reach))} reach
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px] text-xs">
                            Potential reach — outlet audience size reported by Launchmetrics, not article views.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="section-card border p-5 md:p-6">
            <SectionTitle>Top Social</SectionTitle>
            {topSocial.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No social mentions in this period.</p>
            ) : (
              <div className="divide-y divide-border">
                {topSocial.map((s: any, i: number) => (
                  <div key={s.id ?? `${s.voice_name}-${i}`} className="flex items-center gap-3 py-3">
                    <span className="text-muted-foreground shrink-0">{channelIcon(s.channel)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.voice_name ?? s.source_handle}</a>
                        ) : (
                          s.voice_name ?? s.source_handle
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {s.source_handle && <span className="text-[10px] text-muted-foreground truncate">{s.source_handle}</span>}
                        <span className="text-[10px] text-muted-foreground">{formatDay(s.published_at)}</span>
                        {s.in_lefty && (
                          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5" style={{ backgroundColor: SOCIAL_COLOR, color: '#1a1a1a' }}>
                            BPCM CREATOR
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 self-start text-right pt-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground tabular-nums cursor-help">
                            {formatReach(num(s.potential_reach))} reach
                            {s.engagement_rate != null ? ` · ${(num(s.engagement_rate) * (num(s.engagement_rate) <= 1 ? 100 : 1)).toFixed(1)}% eng.` : ''}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] text-xs">
                          Potential reach — audience size reported by Launchmetrics, not views.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default EarnedMediaOverview;
