/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { Chips, arr, fmt, fmtMoney, num, usePrefersReducedMotion, withAlpha } from './influencerCardKit';

/* ------------------------------------------------------------------------------------------------
 * Earned Media: coverage over time.
 * Coverage volume (press placements or social mentions, weekly or monthly) and the value trend (press and
 * social stacked, or one side on its own, per week or as a running total). Each chart highlights its best
 * period, marks the average and reads out what changed.
 * ---------------------------------------------------------------------------------------------- */

const PRESS = 'hsl(226 67% 33%)';
const SOCIAL = 'hsl(42 64% 45%)';

interface Week { key: string; week: string; press_miv: number; social_miv: number; press_count: number; social_count: number }

const dayLabel = (d: string) => {
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

function Segmented<T extends string>({ value, options, onChange, color, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; color: string; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'px-2.5 py-1 text-[11px] font-semibold border -ml-px first:ml-0 transition-colors focus:outline-none focus-visible:ring-2',
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

const darkTip = {
  contentStyle: { backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: 2, fontSize: 11 },
  labelStyle: { color: 'white' },
  itemStyle: { color: 'white' },
} as const;
const tick = { fontSize: 10, fill: 'hsl(0 0% 45%)' } as const;

const momentum = (vals: number[]): number | null => {
  if (vals.length < 4) return null;
  const half = Math.floor(vals.length / 2);
  const a = vals.slice(0, half).reduce((s, v) => s + v, 0) / half;
  const b = vals.slice(vals.length - half).reduce((s, v) => s + v, 0) / half;
  return a > 0 ? ((b - a) / a) * 100 : null;
};

const EarnedMediaTrends = ({ weekly }: { weekly: any[] }) => {
  const reduced = usePrefersReducedMotion();
  const [volBucket, setVolBucket] = useState<'week' | 'month'>('week');
  const [volKind, setVolKind] = useState<'press' | 'social'>('press');
  const [mivView, setMivView] = useState<'both' | 'press' | 'social'>('both');
  const [mivMode, setMivMode] = useState<'weekly' | 'cumulative'>('weekly');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const weeks = useMemo<Week[]>(
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

  /* ---------- coverage volume ---------- */
  const volColor = volKind === 'press' ? PRESS : SOCIAL;
  const volNoun = volKind === 'press' ? 'placements' : 'mentions';
  const vol = useMemo(() => {
    if (volBucket === 'week') {
      return weeks.map(w => ({ label: w.week, value: volKind === 'press' ? w.press_count : w.social_count }));
    }
    const m = new Map<string, number>();
    weeks.forEach(w => {
      const k = w.key.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + (volKind === 'press' ? w.press_count : w.social_count));
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: monthLabel(k), value: v }));
  }, [weeks, volBucket, volKind]);
  const volMax = vol.reduce((b, r, i) => (r.value > (vol[b]?.value ?? -1) ? i : b), 0);
  const volAvg = vol.length ? vol.reduce((s, r) => s + r.value, 0) / vol.length : 0;
  const volTotal = vol.reduce((s, r) => s + r.value, 0);

  const volInsights: string[] = [];
  if (vol.length && vol[volMax].value > 0) {
    volInsights.push(`Busiest ${volBucket}: ${vol[volMax].label}, with ${fmt(vol[volMax].value)} ${volNoun}${volTotal ? ` (${Math.round((vol[volMax].value / volTotal) * 100)}% of the period)` : ''}.`);
  }
  if (vol.length >= 2 && volAvg > 0) volInsights.push(`Average of ${fmt(volAvg)} ${volNoun} a ${volBucket}.`);
  const vm = momentum(vol.map(r => r.value));
  if (vm != null && Math.abs(vm) >= 10) volInsights.push(`The second half of the period is running ${Math.round(Math.abs(vm))}% ${vm > 0 ? 'above' : 'below'} the first.`);
  const last = vol[vol.length - 1];
  if (vol.length >= 3 && last && volAvg > 0 && last.value < volAvg * 0.5) volInsights.push(`${last.label} is well below average, likely because the period is still in progress or coverage is still being logged.`);

  /* ---------- value trend ---------- */
  const mivData = useMemo(() => {
    let cp = 0;
    let cs = 0;
    return weeks.map(w => {
      cp += w.press_miv;
      cs += w.social_miv;
      return mivMode === 'cumulative'
        ? { label: w.week, press: cp, social: cs, press_count: w.press_count, social_count: w.social_count }
        : { label: w.week, press: w.press_miv, social: w.social_miv, press_count: w.press_count, social_count: w.social_count };
    });
  }, [weeks, mivMode]);
  const showPress = mivView !== 'social';
  const showSocial = mivView !== 'press';
  const weekTotals = weeks.map(w => (showPress ? w.press_miv : 0) + (showSocial ? w.social_miv : 0));
  const bestIdx = weekTotals.reduce((b, v, i) => (v > (weekTotals[b] ?? -1) ? i : b), 0);
  const mivAvg = weekTotals.length ? weekTotals.reduce((s, v) => s + v, 0) / weekTotals.length : 0;
  const pressTotal = weeks.reduce((s, w) => s + w.press_miv, 0);
  const socialTotal = weeks.reduce((s, w) => s + w.social_miv, 0);

  const mivInsights: string[] = [];
  if (weeks.length && weekTotals[bestIdx] > 0) {
    const w = weeks[bestIdx];
    const tot = w.press_miv + w.social_miv;
    mivInsights.push(`Biggest week: ${w.week}, worth ${fmtMoney(weekTotals[bestIdx])}${mivView === 'both' && tot ? `, ${Math.round((w.social_miv / tot) * 100)}% of it from social` : ''}.`);
  }
  if (pressTotal + socialTotal > 0 && mivView === 'both') mivInsights.push(`Across the period, social carries ${Math.round((socialTotal / (pressTotal + socialTotal)) * 100)}% of value and press ${Math.round((pressTotal / (pressTotal + socialTotal)) * 100)}%.`);
  const mm = momentum(weekTotals);
  if (mm != null && Math.abs(mm) >= 10) mivInsights.push(`Value in recent weeks is ${Math.round(Math.abs(mm))}% ${mm > 0 ? 'higher' : 'lower'} than in the early weeks.`);
  if (mivMode === 'cumulative' && weeks.length) mivInsights.push(`Running total: ${fmtMoney((showPress ? pressTotal : 0) + (showSocial ? socialTotal : 0))} across ${weeks.length} weeks.`);

  if (!weeks.length) {
    return (
      <div className="section-card border p-5 md:p-6">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Coverage over time</h3>
        <p className="text-xs text-muted-foreground text-center py-8">No weekly coverage in this period.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {/* ---------- coverage volume ---------- */}
      <div className="section-card border overflow-hidden">
        <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${withAlpha(volColor, 0.4)}, ${volColor})` }} />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">Coverage volume</h3>
            <div className="flex flex-wrap gap-2">
              <Segmented<typeof volKind> value={volKind} onChange={setVolKind} color={volColor} label="Coverage type" options={[['press', 'Press'], ['social', 'Social']]} />
              <Segmented<typeof volBucket> value={volBucket} onChange={setVolBucket} color={volColor} label="Group by" options={[['week', 'Weekly'], ['month', 'Monthly']]} />
            </div>
          </div>
          <p className="font-display text-3xl font-bold tabular-nums mt-2" style={{ color: volColor }}>
            {fmt(volTotal)} <span className="text-sm font-normal text-muted-foreground font-sans">{volNoun}</span>
          </p>
          <div className="h-60 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vol} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="em-vol-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={volColor} stopOpacity={1} />
                    <stop offset="100%" stopColor={volColor} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={tick} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip {...darkTip} cursor={{ fill: withAlpha(volColor, 0.06) }} formatter={(v: number) => [fmt(num(v)), volKind === 'press' ? 'Placements' : 'Mentions']} />
                {vol.length >= 2 && volAvg > 0 && (
                  <ReferenceLine y={volAvg} stroke={volColor} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'avg', position: 'insideTopRight', fontSize: 10, fill: 'hsl(0 0% 45%)' }} />
                )}
                <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={!reduced} animationDuration={700}>
                  {vol.map((_, i) => <Cell key={i} fill="url(#em-vol-grad)" fillOpacity={i === volMax ? 1 : 0.65} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Chips items={volInsights.slice(0, 3)} color={volColor} />
        </div>
      </div>

      {/* ---------- value trend ---------- */}
      <div className="section-card border overflow-hidden">
        <div className="h-1" aria-hidden style={{ background: `linear-gradient(90deg, ${PRESS}, ${SOCIAL})` }} />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">MIV trend</h3>
            <div className="flex flex-wrap gap-2">
              <Segmented<typeof mivView> value={mivView} onChange={setMivView} color="hsl(0 0% 15%)" label="Show" options={[['both', 'Both'], ['press', 'Press'], ['social', 'Social']]} />
              <Segmented<typeof mivMode> value={mivMode} onChange={setMivMode} color="hsl(0 0% 15%)" label="Mode" options={[['weekly', 'Weekly'], ['cumulative', 'Running total']]} />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-2">
            {showPress && (
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: PRESS }}>
                {fmtMoney(pressTotal)} <span className="text-xs font-normal text-muted-foreground font-sans">press</span>
              </p>
            )}
            {showSocial && (
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: 'hsl(42 64% 38%)' }}>
                {fmtMoney(socialTotal)} <span className="text-xs font-normal text-muted-foreground font-sans">social</span>
              </p>
            )}
          </div>
          <div className="h-60 mt-3" onMouseLeave={() => setHoverIdx(null)}>
            <ResponsiveContainer width="100%" height="100%">
              {mivMode === 'cumulative' ? (
                <AreaChart data={mivData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="em-cum-press" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRESS} stopOpacity={0.85} /><stop offset="100%" stopColor={PRESS} stopOpacity={0.35} />
                    </linearGradient>
                    <linearGradient id="em-cum-social" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SOCIAL} stopOpacity={0.9} /><stop offset="100%" stopColor={SOCIAL} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                  <XAxis dataKey="label" tick={tick} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => fmtMoney(v)} tick={tick} axisLine={false} tickLine={false} width={56} />
                  <Tooltip {...darkTip} formatter={(v: number, n: string) => [fmtMoney(num(v)), n === 'press' ? 'Press (running total)' : 'Social (running total)']} />
                  {showPress && <Area type="monotone" dataKey="press" stackId="c" stroke={PRESS} strokeWidth={2} fill="url(#em-cum-press)" isAnimationActive={!reduced} />}
                  {showSocial && <Area type="monotone" dataKey="social" stackId="c" stroke={SOCIAL} strokeWidth={2} fill="url(#em-cum-social)" isAnimationActive={!reduced} />}
                </AreaChart>
              ) : (
                <BarChart
                  data={mivData}
                  margin={{ top: 8, right: 8, left: -4, bottom: 0 }}
                  onMouseMove={(s: any) => setHoverIdx(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                  <XAxis dataKey="label" tick={tick} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => fmtMoney(v)} tick={tick} axisLine={false} tickLine={false} width={56} />
                  <Tooltip
                    {...darkTip}
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    formatter={(v: number, n: string, item: any) => {
                      const p = item?.payload ?? {};
                      return n === 'press'
                        ? [`${fmtMoney(num(v))} · ${fmt(num(p.press_count))} placements`, 'Press']
                        : [`${fmtMoney(num(v))} · ${fmt(num(p.social_count))} mentions`, 'Social'];
                    }}
                  />
                  {mivAvg > 0 && <ReferenceLine y={mivAvg} stroke="hsl(0 0% 30%)" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'avg', position: 'insideTopRight', fontSize: 10, fill: 'hsl(0 0% 45%)' }} />}
                  {showPress && (
                    <Bar dataKey="press" stackId="m" fill={PRESS} radius={showSocial ? [0, 0, 0, 0] : [3, 3, 0, 0]} isAnimationActive={!reduced}>
                      {mivData.map((_, i) => <Cell key={i} fillOpacity={hoverIdx == null ? (i === bestIdx ? 1 : 0.8) : hoverIdx === i ? 1 : 0.4} />)}
                    </Bar>
                  )}
                  {showSocial && (
                    <Bar dataKey="social" stackId="m" fill={SOCIAL} radius={[3, 3, 0, 0]} isAnimationActive={!reduced}>
                      {mivData.map((_, i) => <Cell key={i} fillOpacity={hoverIdx == null ? (i === bestIdx ? 1 : 0.8) : hoverIdx === i ? 1 : 0.4} />)}
                    </Bar>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <Chips items={mivInsights.slice(0, 3)} color={PRESS} />
        </div>
      </div>
    </div>
  );
};

export default EarnedMediaTrends;
