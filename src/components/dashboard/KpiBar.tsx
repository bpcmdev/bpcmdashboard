import { useEffect, useState, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import Sparkline from './Sparkline';
import KpiDrawer, { type KpiMetricKey } from './KpiDrawer';
import { formatMoney, formatCount } from '@/lib/format';

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'neutral';
  targetTab?: string;
  metricKey?: KpiMetricKey;
  onSelect?: (metric: KpiMetricKey, label: string, targetTab?: string) => void;
  spark?: number[];
  sparkColor?: string;
  notTracked?: boolean;
  tooltip?: string;
}

/** Animate a numeric value from 0 → target over `duration` ms. Non-numeric values are returned as-is. */
function useCountUp(target: string, duration = 900): string {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const match = target.match(/^([^\d-]*)(-?[\d.]+)(.*)$/);
    if (!match) {
      setDisplay(target);
      return;
    }
    const prefix = match[1];
    const end = parseFloat(match[2]);
    const suffix = match[3];
    if (Number.isNaN(end)) {
      setDisplay(target);
      return;
    }
    const decimals = (match[2].split('.')[1] ?? '').length;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = end * eased;
      setDisplay(`${prefix}${cur.toFixed(decimals)}${suffix}`);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

const KpiCard = ({ label, value, delta, deltaType, targetTab, metricKey, onSelect, spark, sparkColor, notTracked, tooltip }: KpiCardProps) => {
  const animated = useCountUp(notTracked ? '' : value);
  const isPos = deltaType === 'positive';
  const isNeg = deltaType === 'negative';
  const TrendIcon = isPos ? ArrowUpRight : isNeg ? ArrowDownRight : Minus;
  const chip = isPos
    ? 'bg-[hsl(42_64%_46%)]/15 text-[hsl(42_64%_32%)]'
    : isNeg
    ? 'bg-[hsl(0_72%_50%)]/12 text-[hsl(0_72%_42%)]'
    : 'bg-black/[0.06] text-muted-foreground';

  const clickable = !!metricKey;
  const handleClick = () => {
    if (metricKey && onSelect) onSelect(metricKey, label, targetTab);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={tooltip}
      className={`group flex-1 px-3 md:px-5 py-4 md:py-5 text-center min-w-0 relative overflow-hidden animate-fade-in bg-white border-r border-black/10 transition-all duration-200 hover:bg-[hsl(0,0%,98%)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      style={
        sparkColor
          ? ({ ['--kpi-accent' as string]: sparkColor } as React.CSSProperties)
          : undefined
      }
    >
      <p className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[0.18em] uppercase text-muted-foreground mb-1.5 truncate">
        {label}
      </p>
      {notTracked ? (
        <>
          <p className="font-display text-base md:text-lg font-semibold text-muted-foreground/80 leading-tight pt-1">
            Not Yet Tracked
          </p>
          <div className="h-5 mt-2" />
        </>
      ) : (
        <>
          <p className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground tabular-nums leading-none">
            {animated}
          </p>
          <div className="flex items-center justify-center mt-2 h-5">
            {spark && spark.length >= 2 ? (
              <Sparkline values={spark} color={sparkColor ?? '#1B2B8A'} width={88} height={20} />
            ) : (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${chip}`}>
                <TrendIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                <span className="font-mono-ui text-[9px] font-medium tracking-[0.16em] uppercase truncate">
                  {delta.replace(/^[▲▼]\s?/, '')}
                </span>
              </span>
            )}
          </div>
          {spark && spark.length >= 2 && (
            <div className="flex items-center justify-center mt-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${chip}`}>
                <TrendIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                <span className="font-mono-ui text-[9px] font-medium tracking-[0.16em] uppercase truncate">
                  {delta.replace(/^[▲▼]\s?/, '')}
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </button>
  );
};

const fallbackKpis: KpiCardProps[] = [
  { label: 'Press Placements', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Earned Media Value', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Sentiment Score', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Social Reach', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Share of Voice', value: '—', delta: '—', deltaType: 'neutral' },
  { label: 'Influencer ROI', value: '—', delta: '—', deltaType: 'neutral' },
];

type DeltaFmt = 'int' | 'currency' | 'compact' | 'points';

function formatDeltaValue(val: number, fmt: DeltaFmt): string {
  const abs = Math.abs(val);
  switch (fmt) {
    case 'currency':
      return formatMoney(abs);
    case 'compact':
      return formatCount(abs);
    case 'points':
      return `${abs} pts`;
    case 'int':
    default:
      return String(abs);
  }
}

function formatDelta(val: number, fmt: DeltaFmt, suffix = 'vs prior week'): { delta: string; deltaType: 'positive' | 'negative' | 'neutral' } {
  if (!val || !Number.isFinite(val)) return { delta: 'stable', deltaType: 'neutral' };
  const sign = val > 0 ? '+' : '−';
  return {
    delta: `${sign}${formatDeltaValue(val, fmt)} ${suffix}`,
    deltaType: val > 0 ? 'positive' : 'negative',
  };
}

const KpiBar = () => {
  const [kpis, setKpis] = useState<KpiCardProps[]>(fallbackKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawerMetric, setDrawerMetric] = useState<KpiMetricKey | null>(null);
  const [drawerLabel, setDrawerLabel] = useState('');
  const [drawerTab, setDrawerTab] = useState<string | undefined>(undefined);
  const { selectedWeek, refreshKey, activeClientId, isAllTime, effectiveFrom, effectiveTo } = useWeek();
  const { clientColor } = useAdmin();
  const accent = clientColor || '#1B2B8A';

  const openDrawer = (metric: KpiMetricKey, label: string, targetTab?: string) => {
    setDrawerMetric(metric);
    setDrawerLabel(label);
    setDrawerTab(targetTab);
  };

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchKpis = async () => {
      setLoading(true);
      setError(false);

      // Always fetch trailing-8-weeks history for sparklines + "not yet tracked" detection.
      let histQuery = supabase
        .from('weekly_snapshots')
        .select('week_start, placement_count, emv_usd, sentiment_score, social_reach, sov_pct, influencer_roi')
        .order('week_start', { ascending: false })
        .limit(8);
      if (activeClientId) histQuery = histQuery.eq('client_id', activeClientId);
      const { data: hist } = await histQuery;
      const histRows = ((hist ?? []) as Record<string, any>[]).slice().reverse(); // oldest → newest
      const sparkOf = (key: string) => histRows.map(r => Number(r[key]) || 0);
      const allZero = (arr: number[]) => arr.length === 0 || arr.every(v => !v);

      const placementSpark = sparkOf('placement_count');
      const emvSpark = sparkOf('emv_usd');
      const sentimentSpark = sparkOf('sentiment_score');
      const reachSpark = sparkOf('social_reach');
      const sovSpark = sparkOf('sov_pct');
      const roiSpark = sparkOf('influencer_roi');

      const sentimentNotTracked = allZero(sentimentSpark);
      const sovNotTracked = allZero(sovSpark);

      // Influencer ROI now comes from ct_influencer_roi_secure (not weekly_snapshots).
      // All Time → no dates; otherwise pass the effective range start/end.
      const roiParams: Record<string, any> = { p_client_id: activeClientId };
      if (!isAllTime && effectiveFrom && effectiveTo) {
        roiParams.p_start = effectiveFrom;
        roiParams.p_end = effectiveTo;
      }
      const { data: roiData } = await supabase.rpc('ct_influencer_roi_secure' as any, roiParams);
      const roiRow = Array.isArray(roiData) ? (roiData[0] ?? null) : (roiData ?? null);
      const roiEmv = roiRow ? Number(roiRow.emv) : null;
      const roiBillings = roiRow ? Number(roiRow.billings) : null;
      const roiVal = roiRow && roiRow.roi != null ? Number(roiRow.roi) : null;
      const roiTracked = roiVal != null && Number.isFinite(roiVal);
      const roiTile: KpiCardProps = {
        label: 'Influencer ROI',
        value: roiTracked ? `${roiVal!.toFixed(1)}x` : '—',
        delta: roiTracked ? 'EMV per $1 billed' : 'Not yet tracked',
        deltaType: 'neutral',
        targetTab: 'INFLUENCER & SOCIAL',
        metricKey: 'influencer_roi',
        sparkColor: accent,
        notTracked: !roiTracked,
        tooltip: roiTracked
          ? `EMV generated per $1 billed · ${formatMoney(roiEmv ?? 0)} EMV ÷ ${formatMoney(roiBillings ?? 0)} billed`
          : 'Influencer ROI not yet tracked for this period',
      };

      if (isAllTime) {
        let q = supabase.from('weekly_snapshots').select('*');
        if (activeClientId) q = q.eq('client_id', activeClientId);
        const { data, error: err } = await q;
        if (err) {
          console.error('Failed to fetch weekly_snapshots:', err);
          setError(true);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as Record<string, any>[];
        if (rows.length === 0) {
          setKpis(fallbackKpis);
          setLoading(false);
          return;
        }
        const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
        const avg = (k: string) => {
          const vals = rows.map(r => Number(r[k])).filter(v => Number.isFinite(v) && v !== 0);
          return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        };
        const placements = sum('placement_count');
        const emv = sum('emv_usd');
        const reach = sum('social_reach');
        const sentiment = Math.round(avg('sentiment_score'));
        const sov = Number(avg('sov_pct').toFixed(1));
        const roi = Number(avg('influencer_roi').toFixed(1));
        const allTimeDelta = { delta: `${rows.length} weeks`, deltaType: 'neutral' as const };

        setKpis([
          { label: 'Press Placements', value: String(placements), ...allTimeDelta, targetTab: 'EARNED MEDIA', metricKey: 'placement_count', spark: placementSpark, sparkColor: accent },
          { label: 'Earned Media Value', value: formatMoney(emv), ...allTimeDelta, targetTab: 'EARNED MEDIA', metricKey: 'emv_usd', spark: emvSpark, sparkColor: accent },
          { label: 'Sentiment Score', value: `${sentiment}/100`, ...allTimeDelta, metricKey: 'sentiment_score', spark: sentimentNotTracked ? undefined : sentimentSpark, sparkColor: accent, notTracked: sentimentNotTracked },
          { label: 'Social Reach', value: formatCount(reach), ...allTimeDelta, targetTab: 'INFLUENCER & SOCIAL', metricKey: 'social_reach', spark: reachSpark, sparkColor: accent },
          { label: 'Share of Voice', value: `${sov}%`, ...allTimeDelta, metricKey: 'sov_pct', spark: sovNotTracked ? undefined : sovSpark, sparkColor: accent, notTracked: sovNotTracked },
          roiTile,
        ]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('weekly_snapshots')
        .select('*')
        .eq('week_start', selectedWeek)
        .limit(1);

      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      }

      const { data, error: err } = await query.maybeSingle();

      if (err) {
        console.error('Failed to fetch weekly_snapshots:', err);
        setError(true);
        setLoading(false);
        return;
      }

      if (!data) {
        setKpis(fallbackKpis);
        setLoading(false);
        return;
      }

      const r = data as Record<string, any>;
      const placementDelta = formatDelta(r.wow_placement_delta ?? 0, 'int');
      const emvDelta = formatDelta(r.wow_emv_delta ?? 0, 'currency');
      const sentimentDelta = formatDelta(r.mom_sentiment_delta ?? 0, 'points', 'MoM');
      const reachDelta = formatDelta(r.wow_reach_delta ?? 0, 'compact');
      const sovDelta = formatDelta(r.sov_delta_pts ?? 0, 'points');

      setKpis([
        { label: 'Press Placements', value: String(r.placement_count ?? 0), ...placementDelta, targetTab: 'EARNED MEDIA', metricKey: 'placement_count', spark: placementSpark, sparkColor: accent },
        { label: 'Earned Media Value', value: formatMoney(r.emv_usd ?? 0), ...emvDelta, targetTab: 'EARNED MEDIA', metricKey: 'emv_usd', spark: emvSpark, sparkColor: accent },
        { label: 'Sentiment Score', value: `${r.sentiment_score ?? 0}/100`, ...sentimentDelta, metricKey: 'sentiment_score', spark: sentimentNotTracked ? undefined : sentimentSpark, sparkColor: accent, notTracked: sentimentNotTracked && !(r.sentiment_score) },
        { label: 'Social Reach', value: formatCount(r.social_reach ?? 0), ...reachDelta, targetTab: 'INFLUENCER & SOCIAL', metricKey: 'social_reach', spark: reachSpark, sparkColor: accent },
        { label: 'Share of Voice', value: `${r.sov_pct ?? 0}%`, ...sovDelta, metricKey: 'sov_pct', spark: sovNotTracked ? undefined : sovSpark, sparkColor: accent, notTracked: sovNotTracked && !(r.sov_pct) },
        roiTile,
      ]);
      setLoading(false);
    };

    fetchKpis();
  }, [selectedWeek, refreshKey, activeClientId, isAllTime, effectiveFrom, effectiveTo, accent]);

  if (error) {
    return (
      <div className="bg-white border-b border-black/10 px-5 py-4 text-center">
        <p className="text-sm text-destructive">Unable to load data. Please try refreshing.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:flex border-b border-black/10 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 px-3 md:px-5 py-4 md:py-5 text-center space-y-2 border-r border-black/10">
            <Skeleton className="h-3 w-16 md:w-20 mx-auto" />
            <Skeleton className="h-7 md:h-8 w-14 md:w-20 mx-auto" />
            <Skeleton className="h-5 w-20 md:w-24 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 md:flex border-b border-black/10 bg-white">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} onSelect={openDrawer} />
        ))}
      </div>
      <KpiDrawer
        open={drawerMetric !== null}
        onOpenChange={(o) => { if (!o) setDrawerMetric(null); }}
        metric={drawerMetric}
        label={drawerLabel}
        targetTab={drawerTab}
      />
    </>
  );
};

export default KpiBar;
