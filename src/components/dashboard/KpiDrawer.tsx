import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { formatMoney, formatCount } from '@/lib/format';
import { LinkPreviewTrigger } from './LinkPreviewDrawer';

export type KpiMetricKey =
  | 'placement_count'
  | 'emv_usd'
  | 'sentiment_score'
  | 'social_reach'
  | 'sov_pct'
  | 'influencer_roi';

interface KpiDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: KpiMetricKey | null;
  label: string;
  targetTab?: string;
}

interface TrendRow {
  week_start: string;
  value: number;
  label: string;
}

interface TopItem {
  id: string;
  primary: string;
  secondary?: string;
  metric: string;
  url?: string;
}

const FORMATTERS: Record<KpiMetricKey, (n: number) => string> = {
  placement_count: (n) => `${Math.round(n)}`,
  emv_usd: formatMoney,
  sentiment_score: (n) => `${Math.round(n)}/100`,
  social_reach: formatCount,
  sov_pct: (n) => `${n.toFixed(1)}%`,
  influencer_roi: (n) => `${n.toFixed(1)}x`,
};

function fmtWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const KpiDrawer = ({ open, onOpenChange, metric, label, targetTab }: KpiDrawerProps) => {
  const { activeClientId, selectedWeek, effectiveFrom, effectiveTo, isAllTime } = useWeek();
  const { clientColor } = useAdmin();
  const accent = clientColor || '#1B2B8A';
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topLabel, setTopLabel] = useState<string>('Top Contributors');
  const [yoy, setYoy] = useState<{ current: number; prior: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !metric || !activeClientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setTrend([]);
      setTopItems([]);
      setYoy(null);

      // 12-week trend (always trailing from latest available, or from selected week if set).
      let histQuery = supabase
        .from('weekly_snapshots')
        .select(`week_start, ${metric}`)
        .eq('client_id', activeClientId)
        .order('week_start', { ascending: false })
        .limit(12);
      const { data: hist } = await histQuery;
      if (cancelled) return;
      const trendRows = ((hist ?? []) as any[])
        .slice()
        .reverse()
        .map((r) => ({
          week_start: r.week_start,
          value: Number(r[metric]) || 0,
          label: fmtWeekLabel(r.week_start),
        }));
      setTrend(trendRows);

      // YoY: same week, prior year (only when a specific week is selected)
      if (!isAllTime && selectedWeek) {
        const cur = new Date(selectedWeek + 'T00:00:00');
        const prior = new Date(cur);
        prior.setDate(prior.getDate() - 364); // align to week
        const priorIso = prior.toISOString().split('T')[0];
        // Match within ±3 days to tolerate week boundary drift.
        const lower = new Date(prior); lower.setDate(lower.getDate() - 3);
        const upper = new Date(prior); upper.setDate(upper.getDate() + 3);
        const { data: yoyRows } = await supabase
          .from('weekly_snapshots')
          .select(`week_start, ${metric}`)
          .eq('client_id', activeClientId)
          .gte('week_start', lower.toISOString().split('T')[0])
          .lte('week_start', upper.toISOString().split('T')[0])
          .limit(1);
        if (cancelled) return;
        const curRow = trendRows.find((r) => r.week_start === selectedWeek);
        if (curRow && yoyRows && yoyRows.length > 0) {
          setYoy({ current: curRow.value, prior: Number((yoyRows[0] as any)[metric]) || 0 });
        }
      }

      // Top contributors per metric kind
      const dateFrom = !isAllTime ? effectiveFrom : null;
      const dateTo = !isAllTime ? effectiveTo : null;

      if (metric === 'placement_count' || metric === 'emv_usd') {
        // Top press placements + top posts
        let placeQ = supabase
          .from('placements')
          .select('id, headline, outlet_name, outlet_umv, url, published_at')
          .eq('client_id', activeClientId)
          .order(metric === 'emv_usd' ? 'ad_value' : 'outlet_umv', { ascending: false })
          .limit(5);
        if (dateFrom && dateTo) placeQ = placeQ.gte('published_at', dateFrom).lte('published_at', dateTo);
        const { data: placements } = await placeQ;
        if (cancelled) return;
        const items: TopItem[] = ((placements ?? []) as any[]).map((p) => ({
          id: p.id,
          primary: p.headline ?? '—',
          secondary: p.outlet_name ?? undefined,
          metric: p.outlet_umv ? `${formatCount(p.outlet_umv)} reach` : '—',
          url: p.url || undefined,
        }));
        setTopItems(items);
        setTopLabel('Top Press Placements');
      } else if (metric === 'social_reach' || metric === 'influencer_roi') {
        let q = supabase
          .from('lefty_posts')
          .select('id, author_name, campaign_name, reach, emv, post_link, network')
          .eq('client_id', activeClientId)
          .order(metric === 'social_reach' ? 'reach' : 'emv', { ascending: false })
          .limit(5);
        if (dateFrom && dateTo) q = q.gte('posted_at', dateFrom).lte('posted_at', `${dateTo}T23:59:59.999Z`);
        const { data: posts } = await q;
        if (cancelled) return;
        const items: TopItem[] = ((posts ?? []) as any[]).map((p) => ({
          id: p.id,
          primary: p.author_name ?? 'Creator',
          secondary: p.campaign_name ?? p.network ?? undefined,
          metric: metric === 'social_reach' ? formatCount(p.reach ?? 0) : formatMoney(p.emv ?? 0),
          url: p.post_link || undefined,
        }));
        setTopItems(items);
        setTopLabel(metric === 'social_reach' ? 'Top Posts by Reach' : 'Top Posts by EMV');
      } else {
        // Sentiment / SOV — no direct contributors; leave empty.
        setTopItems([]);
        setTopLabel(metric === 'sentiment_score' ? 'Recent Sentiment Drivers' : 'Recent Mentions');
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, metric, activeClientId, selectedWeek, effectiveFrom, effectiveTo, isAllTime]);

  const fmt = metric ? FORMATTERS[metric] : (n: number) => String(n);
  const yoyDelta = useMemo(() => {
    if (!yoy || !yoy.prior) return null;
    const pct = ((yoy.current - yoy.prior) / Math.abs(yoy.prior)) * 100;
    return { pct, up: pct >= 0 };
  }, [yoy]);

  const handleJumpToTab = () => {
    if (targetTab) {
      window.dispatchEvent(new CustomEvent('bpcm:switch-tab', { detail: targetTab }));
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        <div className="space-y-6 pt-2">
          <div>
            <p className="font-mono-ui text-[10px] tracking-[0.22em] uppercase text-muted-foreground mb-1">
              KPI Detail
            </p>
            <SheetTitle className="font-display text-2xl font-bold tracking-tight">{label}</SheetTitle>
          </div>

          {/* 12-week trend */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                12-Week Trend
              </h3>
              {!isAllTime && selectedWeek && (
                <span className="font-mono-ui text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
                  highlight: this week
                </span>
              )}
            </div>
            <div className="bg-card border border-black/10 p-3">
              {loading ? (
                <div className="h-44 bg-black/[0.04] animate-pulse rounded-sm" />
              ) : trend.length < 2 ? (
                <p className="text-xs text-muted-foreground py-12 text-center">
                  Not enough history to chart yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(0 0% 40%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(0 0% 40%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(Number(v))} width={48} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, fontSize: 11 }}
                      formatter={(v: number) => [fmt(v), label]}
                    />
                    {!isAllTime && selectedWeek && trend.find((r) => r.week_start === selectedWeek) && (
                      <ReferenceLine x={fmtWeekLabel(selectedWeek)} stroke={accent} strokeOpacity={0.4} strokeDasharray="3 3" />
                    )}
                    <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={{ r: 2.5, fill: accent }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* YoY */}
          {!isAllTime && (
            <section>
              <h3 className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                Year-over-Year
              </h3>
              <div className="bg-card border border-black/10 p-4">
                {loading ? (
                  <div className="h-12 bg-black/[0.04] animate-pulse rounded-sm" />
                ) : !yoy ? (
                  <p className="text-xs text-muted-foreground">No data for the same week last year.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 items-baseline">
                    <div>
                      <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                        This Week
                      </p>
                      <p className="font-display text-xl font-bold text-foreground tabular-nums">{fmt(yoy.current)}</p>
                    </div>
                    <div>
                      <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                        Same Week YA
                      </p>
                      <p className="font-display text-xl font-semibold text-muted-foreground tabular-nums">{fmt(yoy.prior)}</p>
                    </div>
                    <div>
                      <p className="font-mono-ui text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                        YoY Δ
                      </p>
                      <p
                        className="font-display text-xl font-bold tabular-nums"
                        style={{ color: yoyDelta && yoyDelta.up ? 'hsl(42 64% 38%)' : 'hsl(0 72% 42%)' }}
                      >
                        {yoyDelta ? `${yoyDelta.up ? '+' : ''}${yoyDelta.pct.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Top contributors */}
          <section>
            <h3 className="font-mono-ui text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
              {topLabel}
            </h3>
            <div className="bg-card border border-black/10 divide-y divide-black/[0.06]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-black/[0.03] animate-pulse" />
                ))
              ) : topItems.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No contributing items in this window.
                </p>
              ) : (
                topItems.map((it, i) => (
                  <a
                    key={it.id}
                    href={it.url ?? '#'}
                    target={it.url ? '_blank' : undefined}
                    rel="noreferrer"
                    onClick={(e) => { if (!it.url) e.preventDefault(); }}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.02] transition-colors"
                  >
                    <span className="font-mono-ui text-[10px] text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{it.primary}</p>
                      {it.secondary && <p className="text-[11px] text-muted-foreground truncate">{it.secondary}</p>}
                    </div>
                    <span className="font-display text-sm font-bold tabular-nums shrink-0">{it.metric}</span>
                  </a>
                ))
              )}
            </div>
          </section>

          {targetTab && (
            <button
              onClick={handleJumpToTab}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-black/10 text-[11px] font-mono-ui tracking-[0.18em] uppercase font-medium hover:bg-black/[0.04] transition-colors"
            >
              Open {targetTab} tab <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default KpiDrawer;
