import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import EmptyState from './EmptyState';
import { workstreamFor, colorFor } from '@/lib/workstreamMap';

/* ------------------------------------------------------------------------- */
/*  Types — mirror the public ct_overservice_* views                          */
/* ------------------------------------------------------------------------- */

interface MonthlyRow {
  clicktime_job_id: string;
  project_name: string;
  supabase_client_id: string | null;
  budget_month: string;          // 'YYYY-MM-01'
  monthly_budget: number;
  worked_hours: number;
  billable_value: number;
  budget_remaining: number;
  is_over_serviced: boolean;
  utilization_pct: number;
}

interface TaskRow {
  clicktime_job_id: string;
  budget_month: string;
  task_name: string;
  worked_hours: number;
  billable_value: number;
}

interface EmployeeRow {
  clicktime_job_id: string;
  budget_month: string;
  full_name: string;
  worked_hours: number;
  billable_value: number;
}

/* ------------------------------------------------------------------------- */
/*  Formatters                                                                */
/* ------------------------------------------------------------------------- */

const fmtUSD = (n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, ...opts }).format(n);

const fmtUSDsigned = (n: number) => (n < 0 ? '-' : '+') + fmtUSD(Math.abs(n));

const fmtHours = (n: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}h`;

const fmtKUSD = (n: number) => {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return fmtUSD(n);
};

const fmtPct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

const monthLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' }) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts);

const RED = '#E5484D';
const GREEN = 'hsl(158 64% 32%)';

/* ------------------------------------------------------------------------- */
/*  Tab                                                                       */
/* ------------------------------------------------------------------------- */

const ResourceManagementTab = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();

  const [monthly, setMonthly] = useState<MonthlyRow[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeClientId) {
      setMonthly([]); setTasks([]); setEmployees([]); setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) Monthly rows scoped to the active client (and date range when set).
        let mq = supabase
          .from('ct_overservice_monthly')
          .select('clicktime_job_id,project_name,supabase_client_id,budget_month,monthly_budget,worked_hours,billable_value,budget_remaining,is_over_serviced,utilization_pct')
          .eq('supabase_client_id', activeClientId);
        if (!isAllTime && effectiveFrom && effectiveTo) {
          // budget_month is the first of the month; include any month overlapping the range.
          const startMonth = effectiveFrom.slice(0, 7) + '-01';
          const endMonth = effectiveTo.slice(0, 7) + '-01';
          mq = mq.gte('budget_month', startMonth).lte('budget_month', endMonth);
        }
        const { data: mData, error: mErr } = await mq;
        if (mErr) throw mErr;
        const monthlyRows = (mData ?? []) as MonthlyRow[];

        const jobIds = Array.from(new Set(monthlyRows.map(r => r.clicktime_job_id)));
        if (jobIds.length === 0) {
          if (!cancelled) { setMonthly([]); setTasks([]); setEmployees([]); setLoading(false); }
          return;
        }

        // 2 + 3) Tasks & employees scoped by those job ids + same date range.
        const buildScoped = (table: 'ct_overservice_by_task' | 'ct_overservice_by_employee') => {
          let q = supabase.from(table).select('*').in('clicktime_job_id', jobIds);
          if (!isAllTime && effectiveFrom && effectiveTo) {
            const startMonth = effectiveFrom.slice(0, 7) + '-01';
            const endMonth = effectiveTo.slice(0, 7) + '-01';
            q = q.gte('budget_month', startMonth).lte('budget_month', endMonth);
          }
          return q;
        };

        const [{ data: tData, error: tErr }, { data: eData, error: eErr }] = await Promise.all([
          buildScoped('ct_overservice_by_task'),
          buildScoped('ct_overservice_by_employee'),
        ]);
        if (tErr) throw tErr;
        if (eErr) throw eErr;

        if (!cancelled) {
          setMonthly(monthlyRows);
          setTasks((tData ?? []) as TaskRow[]);
          setEmployees((eData ?? []) as EmployeeRow[]);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to load resource data.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey]);

  /* ----- Aggregations --------------------------------------------------- */

  const agg = useMemo(() => {
    const rows = monthly ?? [];
    const totalHours = rows.reduce((s, r) => s + Number(r.worked_hours || 0), 0);
    const totalBilled = rows.reduce((s, r) => s + Number(r.billable_value || 0), 0);
    const totalBudget = rows.reduce((s, r) => s + Number(r.monthly_budget || 0), 0);
    const overBudget = rows.reduce((s, r) => s + Number(r.budget_remaining || 0), 0);

    // Months actually present in the data (sorted ascending).
    const monthSet = Array.from(new Set(rows.map(r => r.budget_month))).sort();
    const monthsCount = monthSet.length;
    // Working weeks ≈ months × 4.345 (avg weeks per month). Falls back to 1 to avoid div-by-zero.
    const workingWeeks = Math.max(monthsCount * 4.345, 1);

    // Per-month aggregates.
    const byMonth = new Map<string, { budget: number; worked: number }>();
    for (const m of monthSet) byMonth.set(m, { budget: 0, worked: 0 });
    for (const r of rows) {
      const b = byMonth.get(r.budget_month)!;
      b.budget += Number(r.monthly_budget || 0);
      b.worked += Number(r.billable_value || 0);
    }
    const latestMonth = monthSet[monthSet.length - 1];

    // Latest month pacing — billable / (days in month / 7).
    let latestPerWeek = 0;
    if (latestMonth) {
      const d = new Date(latestMonth + 'T00:00:00');
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const weeks = daysInMonth / 7;
      const worked = byMonth.get(latestMonth)?.worked ?? 0;
      latestPerWeek = worked / weeks;
    }

    // Workstream rollup (Section 6) — group monthly rows by project → workstream.
    const wsMap = new Map<string, { hours: number; billing: number }>();
    for (const r of rows) {
      const ws = workstreamFor(r.project_name);
      const cur = wsMap.get(ws) ?? { hours: 0, billing: 0 };
      cur.hours += Number(r.worked_hours || 0);
      cur.billing += Number(r.billable_value || 0);
      wsMap.set(ws, cur);
    }
    const workstreams = Array.from(wsMap.entries())
      .map(([name, v]) => ({ name, ...v, share: totalBilled > 0 ? (v.billing / totalBilled) * 100 : 0 }))
      .sort((a, b) => b.billing - a.billing);

    const overPct = totalBudget > 0 ? Math.round(((totalBilled / totalBudget) - 1) * 100) : 0;

    return {
      totalHours, totalBilled, totalBudget, overBudget,
      monthSet, byMonth, workingWeeks, latestMonth, latestPerWeek,
      workstreams, overPct,
    };
  }, [monthly]);

  /* Section 7 left: top contributors by hours (sum across jobs + months in range). */
  const topContributors = useMemo(() => {
    const map = new Map<string, { hours: number; billing: number }>();
    for (const e of employees ?? []) {
      const cur = map.get(e.full_name) ?? { hours: 0, billing: 0 };
      cur.hours += Number(e.worked_hours || 0);
      cur.billing += Number(e.billable_value || 0);
      map.set(e.full_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [employees]);

  /* Section 7 right: workstream → tasks (need job_id → project_name from monthly rows). */
  const workstreamTasks = useMemo(() => {
    const jobToProject = new Map<string, string>();
    for (const m of monthly ?? []) jobToProject.set(m.clicktime_job_id, m.project_name);

    const wsTaskMap = new Map<string, Map<string, { hours: number; billing: number }>>();
    for (const t of tasks ?? []) {
      const ws = workstreamFor(jobToProject.get(t.clicktime_job_id));
      const inner = wsTaskMap.get(ws) ?? new Map();
      const cur = inner.get(t.task_name) ?? { hours: 0, billing: 0 };
      cur.hours += Number(t.worked_hours || 0);
      cur.billing += Number(t.billable_value || 0);
      inner.set(t.task_name, cur);
      wsTaskMap.set(ws, inner);
    }

    return agg.workstreams.map(ws => {
      const inner = wsTaskMap.get(ws.name);
      const rows = inner
        ? Array.from(inner.entries())
            .map(([task_name, v]) => ({ task_name, ...v }))
            .sort((a, b) => b.billing - a.billing)
        : [];
      return { ...ws, tasks: rows };
    });
  }, [tasks, monthly, agg.workstreams]);

  /* Expanded state for collapsible workstream groups — top 3 open by default. */
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenGroups(new Set(agg.workstreams.slice(0, 3).map(w => w.name)));
  }, [agg.workstreams]);
  const toggleGroup = (name: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  /* ----- Render --------------------------------------------------------- */

  if (!activeClientId) {
    return <EmptyState title="No client selected" description="Choose a client to view resource analytics." />;
  }

  if (!loading && !error && (monthly?.length ?? 0) === 0) {
    return (
      <div className="px-6 py-6">
        <EmptyState
          title="No ClickTime data"
          description="No billing or budget data is available for this client in the selected range."
        />
      </div>
    );
  }

  return (
    <DataStateWrapper loading={loading} error={!!error}>

      <div className="px-6 py-6 space-y-8 tabular-nums">
        {/* ===== Section 1 — KPI strip ===== */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total Hours Worked" value={fmtHours(agg.totalHours)} />
            <KpiCard label="Total Billed" value={fmtUSD(agg.totalBilled)} />
            <KpiCard label="Total Budget" value={fmtUSD(agg.totalBudget)} />
            <KpiCard
              label="Over Budget YTD"
              value={fmtUSDsigned(agg.overBudget)}
              valueColor={agg.overBudget < 0 ? RED : undefined}
            />
            <KpiCard
              label="Avg Weekly Burn"
              value={fmtUSD(agg.totalBilled / agg.workingWeeks)}
            />
          </div>
        </section>

        {/* ===== Section 2 — Monthly Budget vs Worked ===== */}
        <section>
          <SectionLabel>Monthly Budget vs Worked</SectionLabel>
          <div className="border border-black/10 rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/[0.03] text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Metric</th>
                  {agg.monthSet.map(m => (
                    <th key={m} className="text-right px-4 py-2 font-medium">{monthLabel(m)}</th>
                  ))}
                  <th className="text-right px-4 py-2 font-bold text-foreground border-l border-black/10">YTD</th>
                </tr>
              </thead>
              <tbody>
                <MonthRow label="Budget" months={agg.monthSet} get={m => agg.byMonth.get(m)?.budget ?? 0} total={agg.totalBudget} />
                <MonthRow label="Worked" months={agg.monthSet} get={m => agg.byMonth.get(m)?.worked ?? 0} total={agg.totalBilled} />
                <MonthRow
                  label="Over/Under"
                  months={agg.monthSet}
                  get={m => {
                    const b = agg.byMonth.get(m);
                    return (b?.budget ?? 0) - (b?.worked ?? 0);
                  }}
                  total={agg.totalBudget - agg.totalBilled}
                  signed
                  isLast
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== Section 3 — Over-pace alert ===== */}
        {agg.overBudget < 0 && agg.latestMonth && (
          <div
            className="flex items-start gap-3 rounded-md border px-4 py-3"
            style={{ borderColor: 'hsl(42 64% 45% / 0.4)', background: 'hsl(42 90% 96%)' }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: 'hsl(32 95% 44%)' }} />
            <div className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold uppercase tracking-wider text-[11px] mr-2" style={{ color: 'hsl(32 95% 44%)' }}>
                Over-pace alert
              </span>
              {agg.overPct}% above budget YTD. BPCM has billed {fmtUSD(Math.abs(agg.overBudget))} above the retainer through{' '}
              {monthLabel(agg.latestMonth, { month: 'long' })}.
            </div>
          </div>
        )}

        {/* ===== Section 4 — Weekly Pacing Estimate ===== */}
        <section>
          <SectionLabel>Weekly Pacing Estimate</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Budget / Week" value={fmtUSD(agg.totalBudget / agg.workingWeeks)} />
            <KpiCard
              label="Actual / Week"
              value={fmtUSD(agg.totalBilled / agg.workingWeeks)}
              valueColor={agg.totalBilled > agg.totalBudget ? RED : undefined}
            />
            <KpiCard
              label="Over / Week Avg"
              value={fmtUSDsigned((agg.totalBilled - agg.totalBudget) / agg.workingWeeks)}
              valueColor={agg.totalBilled > agg.totalBudget ? RED : GREEN}
            />
            <KpiCard
              label="Latest Month Pace"
              value={fmtUSD(agg.latestPerWeek)}
              valueColor={
                agg.latestMonth && (agg.byMonth.get(agg.latestMonth)?.worked ?? 0) <= (agg.byMonth.get(agg.latestMonth)?.budget ?? 0)
                  ? GREEN
                  : RED
              }
            />
          </div>
        </section>

        {/* ===== Section 5 — YTD Budget Utilization bar ===== */}
        <section>
          <SectionLabel>YTD Budget Utilization</SectionLabel>
          {(() => {
            const pct = agg.totalBudget > 0 ? (agg.totalBilled / agg.totalBudget) * 100 : 0;
            const baseW = Math.min(pct, 100);
            const overW = Math.max(pct - 100, 0);
            // Scale the visual track so values >100% still fit.
            const trackPctMax = Math.max(100, pct);
            const baseFill = (baseW / trackPctMax) * 100;
            const overFill = (overW / trackPctMax) * 100;
            const capMarker = (100 / trackPctMax) * 100;
            return (
              <div>
                <div className="relative h-3 bg-black/[0.06] rounded-sm overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full"
                    style={{ width: `${baseFill}%`, background: 'var(--client-accent, hsl(225 70% 35%))' }}
                  />
                  <div
                    className="absolute top-0 h-full"
                    style={{ left: `${baseFill}%`, width: `${overFill}%`, background: RED }}
                  />
                  <div
                    className="absolute top-0 h-full border-l border-black/40"
                    style={{ left: `${capMarker}%`, width: 0 }}
                  />
                </div>
                <div className="flex justify-between text-[11px] mt-2 text-muted-foreground">
                  <span>$0</span>
                  <span>Budget cap: <span className="text-foreground font-medium">{fmtUSD(agg.totalBudget)}</span></span>
                  <span>
                    Worked: <span className="text-foreground font-medium">{fmtUSD(agg.totalBilled)}</span>{' '}
                    (<span style={{ color: pct > 100 ? RED : undefined }}>{fmtPct(pct)}</span>)
                  </span>
                </div>
              </div>
            );
          })()}
        </section>

        {/* ===== Section 6 — Hours & Billing by Workstream ===== */}
        <section>
          <SectionLabel>Hours &amp; Billing by Workstream</SectionLabel>
          <div className="border border-black/10 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/[0.03] text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Workstream</th>
                  <th className="text-right px-4 py-2 font-medium">Hours</th>
                  <th className="text-right px-4 py-2 font-medium">Billing</th>
                  <th className="text-right px-4 py-2 font-medium">Share</th>
                  <th className="text-left px-4 py-2 font-medium w-[34%]">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {agg.workstreams.map(w => (
                  <tr key={w.name} className="border-t border-black/5">
                    <td className="px-4 py-2.5">{w.name}</td>
                    <td className="px-4 py-2.5 text-right">{fmtHours(w.hours)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtUSD(w.billing)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtPct(w.share, 1)}</td>
                    <td className="px-4 py-2.5">
                      <div className="h-1.5 bg-black/[0.06] rounded-sm overflow-hidden">
                        <div className="h-full" style={{ width: `${w.share}%`, background: colorFor(w.name) }} />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black/20 font-semibold bg-black/[0.02]">
                  <td className="px-4 py-2.5">Subtotal</td>
                  <td className="px-4 py-2.5 text-right">{fmtHours(agg.totalHours)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtUSD(agg.totalBilled)}</td>
                  <td className="px-4 py-2.5 text-right">100%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== Section 7 — Bottom row: contributors + workstream tasks ===== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Top Contributors by Hours */}
          <div>
            <SectionLabel>Top Contributors by Hours</SectionLabel>
            <div className="border border-black/10 rounded-md p-4 space-y-2.5">
              {topContributors.length === 0 && (
                <div className="text-xs text-muted-foreground py-6 text-center">No contributor data.</div>
              )}
              {(() => {
                const maxHours = Math.max(...topContributors.map(c => c.hours), 1);
                return topContributors.map(c => {
                  const w = (c.hours / maxHours) * 100;
                  return (
                    <div key={c.name} className="flex items-center gap-3 text-sm">
                      <div className="w-44 truncate capitalize">{c.name.toLowerCase()}</div>
                      <div className="flex-1 h-2 bg-black/[0.06] rounded-sm overflow-hidden">
                        <div className="h-full" style={{ width: `${w}%`, background: 'var(--client-accent, hsl(225 70% 35%))' }} />
                      </div>
                      <div className="w-16 text-right text-muted-foreground">{fmtHours(c.hours)}</div>
                      <div className="w-16 text-right font-medium">{fmtKUSD(c.billing)}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Right — Workstream by Task (collapsible) */}
          <div>
            <SectionLabel>Workstream by Task</SectionLabel>
            <div className="border border-black/10 rounded-md divide-y divide-black/5">
              {workstreamTasks.map(ws => {
                const isOpen = openGroups.has(ws.name);
                const tint = colorFor(ws.name);
                return (
                  <div key={ws.name}>
                    <button
                      onClick={() => toggleGroup(ws.name)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/[0.02] transition"
                      style={{ background: isOpen ? 'rgba(0,0,0,0.015)' : undefined }}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-medium flex-1 text-left">{ws.name}</span>
                      <span className="text-muted-foreground">{fmtHours(ws.hours)}</span>
                      <span className="font-semibold w-24 text-right">{fmtUSD(ws.billing)}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 pt-1 space-y-1.5">
                        {ws.tasks.length === 0 && (
                          <div className="text-xs text-muted-foreground py-2">No tasks in range.</div>
                        )}
                        {ws.tasks.map(t => {
                          const share = ws.billing > 0 ? (t.billing / ws.billing) * 100 : 0;
                          return (
                            <div key={t.task_name} className="flex items-center gap-3 text-[13px]">
                              <div className="w-48 truncate text-foreground/90 capitalize">{t.task_name.toLowerCase()}</div>
                              <div className="flex-1 h-1.5 bg-black/[0.05] rounded-sm overflow-hidden">
                                <div className="h-full" style={{ width: `${share}%`, background: tint }} />
                              </div>
                              <div className="w-14 text-right text-muted-foreground tabular-nums">{fmtHours(t.hours)}</div>
                              <div className="w-20 text-right tabular-nums">{fmtUSD(t.billing)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </DataStateWrapper>
  );
};

/* ------------------------------------------------------------------------- */
/*  Small render helpers                                                      */
/* ------------------------------------------------------------------------- */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-3">{children}</div>
);

const KpiCard = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <div className="border border-black/10 rounded-md px-4 py-3 bg-card">
    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">{label}</div>
    <div className="text-xl font-semibold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
      {value}
    </div>
  </div>
);

const MonthRow = ({
  label, months, get, total, signed, isLast,
}: {
  label: string;
  months: string[];
  get: (m: string) => number;
  total: number;
  signed?: boolean;
  isLast?: boolean;
}) => (
  <tr className={isLast ? 'border-t border-black/10' : 'border-t border-black/5'}>
    <td className="px-4 py-2.5 font-medium">{label}</td>
    {months.map(m => {
      const v = get(m);
      const color = signed ? (v < 0 ? RED : v > 0 ? GREEN : undefined) : undefined;
      return (
        <td key={m} className="px-4 py-2.5 text-right tabular-nums" style={color ? { color } : undefined}>
          {signed ? (v === 0 ? '$0' : fmtUSDsigned(v)) : fmtUSD(v)}
        </td>
      );
    })}
    <td
      className="px-4 py-2.5 text-right font-bold tabular-nums border-l border-black/10"
      style={signed ? { color: total < 0 ? RED : total > 0 ? GREEN : undefined } : undefined}
    >
      {signed ? (total === 0 ? '$0' : fmtUSDsigned(total)) : fmtUSD(total)}
    </td>
  </tr>
);

export default ResourceManagementTab;
