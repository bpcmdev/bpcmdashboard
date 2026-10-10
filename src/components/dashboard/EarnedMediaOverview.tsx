import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { formatMoney, formatCount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Image as ImageIcon, Instagram, Youtube, Music2, Twitter, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import EarnedMediaHero from './EarnedMediaHero';
import EarnedMediaQuality from './EarnedMediaQuality';
import EarnedMediaDrivers from './EarnedMediaDrivers';
import EarnedMediaTrends from './EarnedMediaTrends';
import EarnedMediaTopHits from './EarnedMediaTopHits';

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
        {/* 1 + 2 — HERO VALUE CARD AND STAT CARDS */}
        <EarnedMediaHero
          totals={t}
          prior={prior}
          weekly={weekly}
          tierMix={tierMix}
          pressChannelMix={arr(summary.press_channel_mix)}
          socialChannelMix={arr(summary.social_channel_mix)}
          topOutlets={topOutlets}
          topSocial={topSocial}
        />

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

        {/* 3b + 4 — COVERAGE VOLUME AND MIV TREND */}
        <EarnedMediaTrends weekly={weekly} />

        {/* 5 — QUALITY */}
        <EarnedMediaQuality tierMix={tierMix} pressChannelMix={arr(summary.press_channel_mix)} />

        {/* 6 — WHAT DROVE IT */}
        <EarnedMediaDrivers topOutlets={topOutlets} byProduct={byProduct} />

        {/* 7 — TOP HITS */}
        <EarnedMediaTopHits topPress={topPress} topSocial={topSocial} />
      </div>
    </TooltipProvider>
  );
};

export default EarnedMediaOverview;
