import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import DataStateWrapper from './DataStateWrapper';
import EmptyState from './EmptyState';
import { workstreamFor, colorFor } from '@/lib/workstreamMap';

/* ------------------------------------------------------------------------- */
/*  Types                                                                     */
/* ------------------------------------------------------------------------- */

interface ClientMonthlyRow {
  supabase_client_id: string;
  budget_month: string;            // 'YYYY-MM-01'
  monthly_budget: number | null;   // null when budget export not yet loaded
  worked_hours: number;
  billable_value: number;
  budget_remaining: number | null;
  is_over_serviced: boolean;
  utilization_pct: number | null;
}

interface TaskRow {
  project_name: string;
  clicktime_job_id: string;
  budget_month: string;
  task_name: string;
  worked_hours: number;
  billable_value: number;
}

interface EmployeeRow {
  project_name: string;
  clicktime_job_id: string;
  budget_month: string;
  full_name: string;
  worked_hours: number;
  billable_value: number;
}

interface PortfolioRow {
  supabase_client_id: string;
  client_name: string;
  budget_month: string;
  monthly_budget: number | null;
  worked_hours: number;
  billable_value: number;
  budget_remaining: number | null;
  utilization_pct: number | null;
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
const BLUE = 'hsl(217 91% 50%)';

/** Strip the leading "<prefix> – " or "<prefix> - " from a task name.
 *  Preserves original casing of the remainder so "VWFS" stays "VWFS". */
function stripWorkstreamPrefix(task: string): string {
  if (!task) return task;
  const m = task.match(/^[^\u2013\-]+[\u2013\-]\s*(.+)$/);
  return m ? m[1].trim() : task;
}

/** Business days between two dates inclusive (Mon–Fri). */
function businessDaysBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/* ------------------------------------------------------------------------- */
/*  Tab                                                                       */
/* ------------------------------------------------------------------------- */

const ResourceManagementTab = () => {
  const { activeClientId, effectiveFrom, effectiveTo, isAllTime, refreshKey } = useWeek();
  const { isAdmin } = useAdmin();

  const [monthly, setMonthly] = useState<ClientMonthlyRow[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[] | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioRow[] | null>(null);
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
        // Expand the active range to month boundaries.
        const firstOfMonth = (iso: string) => iso.slice(0, 7) + '-01';
        const fromArg = isAllTime || !effectiveFrom ? null : firstOfMonth(effectiveFrom);
        const toArg   = isAllTime || !effectiveTo   ? null : firstOfMonth(effectiveTo);

        const [
          { data: mData, error: mErr },
          { data: tData, error: tErr },
          { data: eData, error: eErr },
        ] = await Promise.all([
          supabase.rpc('ct_overservice_client_monthly_secure', { p_client_id: activeClientId, p_from: fromArg, p_to: toArg }),
          supabase.rpc('ct_overservice_tasks_client_secure',     { p_client_id: activeClientId, p_from: fromArg, p_to: toArg }),
          supabase.rpc('ct_overservice_employees_client_secure', { p_client_id: activeClientId, p_from: fromArg, p_to: toArg }),
        ]);
        if (mErr) throw mErr;
        if (tErr) throw tErr;
        if (eErr) throw eErr;

        if (!cancelled) {
          const rows = ((mData ?? []) as ClientMonthlyRow[]).slice().sort((a, b) => a.budget_month.localeCompare(b.budget_month));
          setMonthly(rows);
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

  /* Admin-only portfolio query — current month, all clients. */
  useEffect(() => {
    if (!isAdmin) { setPortfolio(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error: pErr } = await supabase.rpc('ct_portfolio_summary_secure', {});
      if (cancelled) return;
      if (pErr) { setPortfolio([]); return; }
      setPortfolio((data ?? []) as PortfolioRow[]);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, refreshKey]);

  /* Granularity caption. */
  const granularityLabel = useMemo(() => {
    if (isAllTime || !effectiveFrom || !effectiveTo) return 'Showing all months (monthly data)';
    const startIso = effectiveFrom.slice(0, 7) + '-01';
    const endIso = effectiveTo.slice(0, 7) + '-01';
    const fmtFull = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const fmtMonth = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
    const fmtMonthYear = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (startIso === endIso) return `Showing ${fmtFull(startIso)} (monthly data)`;
    const sameYear = startIso.slice(0, 4) === endIso.slice(0, 4);
    return sameYear
      ? `Showing ${fmtMonth(startIso)}–${fmtMonthYear(endIso)} (monthly data)`
      : `Showing ${fmtFull(startIso)} – ${fmtFull(endIso)} (monthly data)`;
  }, [isAllTime, effectiveFrom, effectiveTo]);

  /* Aggregations from the monthly client-level RPC. */
  const agg = useMemo(() => {
    const rows = monthly ?? [];
    const monthSet = rows.map(r => r.budget_month);

    const byMonth = new Map<string, { budget: number | null; worked: number; hours: number }>();
    for (const r of rows) {
      byMonth.set(r.budget_month, {
        budget: r.monthly_budget == null ? null : Number(r.monthly_budget),
        worked: Number(r.billable_value || 0),
        hours: Number(r.worked_hours || 0),
      });
    }

    const totalHours  = rows.reduce((s, r) => s + Number(r.worked_hours || 0), 0);
    const totalBilled = rows.reduce((s, r) => s + Number(r.billable_value || 0), 0);

    const budgetedMonths = monthSet.filter(m => byMonth.get(m)?.budget != null);
    const unbudgetedMonths = monthSet.filter(m => byMonth.get(m)?.budget == null);
    const monthHasBudget = (m: string) => byMonth.get(m)?.budget != null;

    const budgetedWorked = budgetedMonths.reduce((s, m) => s + (byMonth.get(m)?.worked ?? 0), 0);
    const totalBudget    = budgetedMonths.reduce((s, m) => s + (byMonth.get(m)?.budget ?? 0), 0);
    // Positive = under budget, negative = over budget.
    const remaining = totalBudget - budgetedWorked;

    const workingWeeks = Math.max(budgetedMonths.length * 4.345, 1);
    const latestMonth = monthSet[monthSet.length - 1];

    let latestPerWeek = 0;
    if (latestMonth) {
      const d = new Date(latestMonth + 'T00:00:00');
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      latestPerWeek = (byMonth.get(latestMonth)?.worked ?? 0) / (daysInMonth / 7);
    }

    const overPct = totalBudget > 0 ? Math.round(((budgetedWorked / totalBudget) - 1) * 100) : 0;
    const effectiveRate = totalHours > 0 ? totalBilled / totalHours : 0;

    // Month-end projection for the latest month, if it's the current calendar month.
    let projection: { month: string; projected: number; budget: number | null } | null = null;
    if (latestMonth) {
      const today = new Date();
      const cm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      if (latestMonth === cm) {
        const d = new Date(latestMonth + 'T00:00:00');
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const elapsed = businessDaysBetween(start, today);
        const total   = businessDaysBetween(start, end);
        const worked  = byMonth.get(latestMonth)?.worked ?? 0;
        if (elapsed > 0) {
          projection = {
            month: latestMonth,
            projected: (worked / elapsed) * total,
            budget: byMonth.get(latestMonth)?.budget ?? null,
          };
        }
      }
    }

    return {
      totalHours, totalBilled, totalBudget, remaining, budgetedWorked,
      monthSet, byMonth, workingWeeks, latestMonth, latestPerWeek,
      overPct, budgetedMonths, unbudgetedMonths, monthHasBudget,
      effectiveRate, projection,
    };
  }, [monthly]);

  /* Workstream rollup — from tasks RPC (NOT intersected with monthly). */
  const workstreams = useMemo(() => {
    const wsMap = new Map<string, { hours: number; billing: number }>();
    for (const t of tasks ?? []) {
      const ws = workstreamFor(t.project_name);
      const cur = wsMap.get(ws) ?? { hours: 0, billing: 0 };
      cur.hours   += Number(t.worked_hours  || 0);
      cur.billing += Number(t.billable_value || 0);
      wsMap.set(ws, cur);
    }
    const totalBilling = Array.from(wsMap.values()).reduce((s, v) => s + v.billing, 0);
    return Array.from(wsMap.entries())
      .map(([name, v]) => ({
        name, ...v,
        share: totalBilling > 0 ? (v.billing / totalBilling) * 100 : 0,
        rate:  v.hours > 0 ? v.billing / v.hours : 0,
      }))
      .sort((a, b) => b.billing - a.billing);
  }, [tasks]);

  const wsTotals = useMemo(() => {
    const hours   = workstreams.reduce((s, w) => s + w.hours, 0);
    const billing = workstreams.reduce((s, w) => s + w.billing, 0);
    return { hours, billing, rate: hours > 0 ? billing / hours : 0 };
  }, [workstreams]);

  /* Top contributors (from employees RPC — all projects). */
  const topContributors = useMemo(() => {
    const map = new Map<string, { hours: number; billing: number }>();
    for (const e of employees ?? []) {
      const cur = map.get(e.full_name) ?? { hours: 0, billing: 0 };
      cur.hours   += Number(e.worked_hours  || 0);
      cur.billing += Number(e.billable_value || 0);
      map.set(e.full_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [employees]);

  /* Workstream → tasks (from tasks RPC). */
  const workstreamTasks = useMemo(() => {
    const wsTaskMap = new Map<string, Map<string, { hours: number; billing: number }>>();
    for (const t of tasks ?? []) {
      const ws = workstreamFor(t.project_name);
      const cleanName = stripWorkstreamPrefix(t.task_name);
      const inner = wsTaskMap.get(ws) ?? new Map();
      const cur = inner.get(cleanName) ?? { hours: 0, billing: 0 };
      cur.hours   += Number(t.worked_hours  || 0);
      cur.billing += Number(t.billable_value || 0);
      inner.set(cleanName, cur);
      wsTaskMap.set(ws, inner);
    }
    return workstreams.map(ws => {
      const inner = wsTaskMap.get(ws.name);
      const rows = inner
        ? Array.from(inner.entries())
            .map(([task_name, v]) => ({ task_name, ...v }))
            .sort((a, b) => b.billing - a.billing)
        : [];
      return { ...ws, tasks: rows };
    });
  }, [tasks, workstreams]);

  /* Expanded state for collapsible workstream groups. */
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [expandedAll, setExpandedAll] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenGroups(new Set(workstreams.slice(0, 3).map(w => w.name)));
  }, [workstreams]);
  const toggleGroup = (name: string) =>
    setOpenGroups(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const toggleAll = (name: string) =>
    setExpandedAll(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  /* Data freshness — max budget_month across all RPC sources. */
  const freshness = useMemo(() => {
    const all: string[] = [];
    for (const r of monthly ?? []) all.push(r.budget_month);
    for (const r of tasks ?? []) all.push(r.budget_month);
    if (all.length === 0) return null;
    const max = all.sort().slice(-1)[0];
    return new Date(max + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [monthly, tasks]);

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

  const overYTD = agg.remaining < 0; // worked more than budgeted

  return (
    <DataStateWrapper loading={loading} error={!!error}>
      <div className="px-6 py-6 space-y-8 tabular-nums">

        {/* Caption row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground">
            {granularityLabel}
          </div>
          {freshness && (
            <div className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground">
              ClickTime data through {freshness}
            </div>
          )}
        </div>

        {/* ===== Section 1 — KPI strip ===== */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-black/10 border border-black/10 rounded-md overflow-hidden">
            <KpiCard label="Hours Worked"   value={fmtHours(agg.totalHours)} />
            <KpiCard label="Billed"          value={fmtUSD(agg.totalBilled)} />
            <KpiCard label="Budget"          value={fmtUSD(agg.totalBudget)} />
            <KpiCard
              label={overYTD ? 'Over Budget · YTD' : 'Under Budget · YTD'}
              value={fmtUSD(Math.abs(agg.remaining))}
              signed={agg.remaining}
            />
            <KpiCard label="Weekly Burn"     value={fmtUSD(agg.totalBilled / agg.workingWeeks)} />
            <KpiCard label="Effective Rate"  value={`${fmtUSD(agg.effectiveRate)}/h`} />
          </div>
        </section>

        {/* ===== Month-by-month paired bar chart ===== */}
        {agg.monthSet.length > 0 && (
          <section>
            <SectionLabel>Monthly Budget vs Worked — Chart</SectionLabel>
            <MonthlyBarChart
              months={agg.monthSet}
              get={m => ({
                budget: agg.byMonth.get(m)?.budget ?? null,
                worked: agg.byMonth.get(m)?.worked ?? 0,
              })}
            />
          </section>
        )}

        {/* ===== Section 2 — Monthly Budget vs Worked table ===== */}
        <section>
          <SectionLabel>Monthly Budget vs Worked</SectionLabel>
          <div className="border border-black/10 rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/[0.03] text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Metric</th>
                  {agg.monthSet.map(m => (
                    <th key={m} className="text-right px-4 py-2 font-medium tabular-nums">{monthLabel(m)}</th>
                  ))}
                  <th className="text-right px-4 py-2 font-bold text-foreground border-l border-black/10 tabular-nums">YTD</th>
                </tr>
              </thead>
              <tbody>
                <MonthRow
                  label="Budget"
                  months={agg.monthSet}
                  get={m => agg.byMonth.get(m)?.budget ?? 0}
                  total={agg.totalBudget}
                  dashWhen={m => !agg.monthHasBudget(m)}
                />
                <MonthRow
                  label="Worked"
                  months={agg.monthSet}
                  get={m => agg.byMonth.get(m)?.worked ?? 0}
                  total={agg.totalBilled}
                />
                <MonthRow
                  label="Over/Under"
                  months={agg.monthSet}
                  get={m => {
                    const b = agg.byMonth.get(m);
                    return (b?.budget ?? 0) - (b?.worked ?? 0);
                  }}
                  total={agg.remaining}
                  signed
                  isLast
                  dashWhen={m => !agg.monthHasBudget(m)}
                />
              </tbody>
            </table>
          </div>
          {agg.unbudgetedMonths.length > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground italic">
              Budget not yet loaded for {agg.unbudgetedMonths.map(m => monthLabel(m, { month: 'long', year: 'numeric' })).join(', ')}.
              Over/Under and utilization exclude {agg.unbudgetedMonths.length === 1 ? 'this month' : 'these months'}.
            </div>
          )}
        </section>

        {/* ===== Section 3 — Over-pace alert ===== */}
        {overYTD && agg.latestMonth && (
          <div
            className="flex items-start gap-3 rounded-md border px-4 py-3"
            style={{ borderColor: 'hsl(42 64% 45% / 0.4)', background: 'hsl(42 90% 96%)' }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: 'hsl(32 95% 44%)' }} />
            <div className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold uppercase tracking-wider text-[11px] mr-2" style={{ color: 'hsl(32 95% 44%)' }}>
                Over-pace alert
              </span>
              {agg.overPct}% above budget YTD. BPCM has billed {fmtUSD(Math.abs(agg.remaining))} above the retainer through{' '}
              {monthLabel(agg.latestMonth, { month: 'long' })}.
            </div>
          </div>
        )}

        {/* ===== Section 4 — Weekly Pacing ===== */}
        <section>
          <SectionLabel>Weekly Pacing Estimate</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Budget / Week" value={fmtUSD(agg.totalBudget / agg.workingWeeks)} />
            <KpiCard
              label="Actual / Week"
              value={fmtUSD(agg.budgetedWorked / agg.workingWeeks)}
              valueColor={agg.budgetedWorked > agg.totalBudget ? RED : undefined}
            />
            {(() => {
              const delta = (agg.budgetedWorked - agg.totalBudget) / agg.workingWeeks;
              const over = delta > 0;
              const label = over ? 'Over / Week Avg' : 'Under / Week Avg';
              const value = over ? `-${fmtUSD(Math.abs(delta))}` : `+${fmtUSD(Math.abs(delta))}`;
              return <KpiCard label={label} value={value} valueColor={over ? RED : GREEN} />;
            })()}
            {(() => {
              const hasBudget = agg.latestMonth && agg.monthHasBudget(agg.latestMonth);
              const worked = agg.latestMonth ? (agg.byMonth.get(agg.latestMonth)?.worked ?? 0) : 0;
              const budget = agg.latestMonth ? (agg.byMonth.get(agg.latestMonth)?.budget ?? 0) : 0;
              const over = hasBudget && worked > budget;
              return (
                <KpiCard
                  label="Latest Month Pace"
                  value={fmtUSD(agg.latestPerWeek)}
                  valueColor={hasBudget ? (over ? RED : GREEN) : undefined}
                />
              );
            })()}
          </div>
          {agg.projection && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Projected for {monthLabel(agg.projection.month, { month: 'long' })}:{' '}
              <span className="font-medium text-foreground">{fmtUSD(agg.projection.projected)}</span>
              {agg.projection.budget != null && <> vs {fmtUSD(agg.projection.budget)} budget</>}.
            </div>
          )}
        </section>

        {/* ===== Section 5 — YTD utilization bar ===== */}
        <section>
          <SectionLabel>YTD Budget Utilization</SectionLabel>
          {(() => {
            const pct = agg.totalBudget > 0 ? (agg.budgetedWorked / agg.totalBudget) * 100 : 0;
            const baseW = Math.min(pct, 100);
            const overW = Math.max(pct - 100, 0);
            const trackMax = Math.max(100, pct);
            const baseFill = (baseW / trackMax) * 100;
            const overFill = (overW / trackMax) * 100;
            const capMarker = (100 / trackMax) * 100;
            return (
              <div>
                <div className="relative h-5 bg-black/[0.06] rounded-sm overflow-hidden">
                  <div className="absolute left-0 top-0 h-full" style={{ width: `${baseFill}%`, background: BLUE }} />
                  <div className="absolute top-0 h-full" style={{ left: `${baseFill}%`, width: `${overFill}%`, background: RED }} />
                  <div className="absolute top-0 h-full border-l border-black/50" style={{ left: `${capMarker}%`, width: 0 }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white mix-blend-difference tabular-nums">
                    {fmtPct(pct)}
                  </div>
                </div>
                <div className="flex justify-between text-[11px] mt-2 text-muted-foreground tabular-nums">
                  <span>$0</span>
                  <span>Budget cap: <span className="text-foreground font-medium">{fmtUSD(agg.totalBudget)}</span></span>
                  <span>Worked: <span className="text-foreground font-medium">{fmtUSD(agg.budgetedWorked)}</span></span>
                </div>
                {agg.unbudgetedMonths.length > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground italic">
                    Excludes {agg.unbudgetedMonths.map(m => monthLabel(m, { month: 'long' })).join(', ')} — budget not yet loaded.
                  </div>
                )}
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
                  <th className="text-right px-4 py-2 font-medium">Eff. Rate</th>
                  <th className="text-right px-4 py-2 font-medium">Share</th>
                  <th className="text-left px-4 py-2 font-medium w-[28%]">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {workstreams.map(w => (
                  <tr key={w.name} className="border-t border-black/5">
                    <td className="px-4 py-2.5">{w.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtHours(w.hours)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtUSD(w.billing)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{w.rate > 0 ? `${fmtUSD(w.rate)}/h` : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtPct(w.share, 1)}</td>
                    <td className="px-4 py-2.5">
                      <div className="h-1.5 bg-black/[0.06] rounded-sm overflow-hidden">
                        <div className="h-full" style={{ width: `${w.share}%`, background: colorFor(w.name) }} />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black/20 font-semibold bg-black/[0.02]">
                  <td className="px-4 py-2.5">Subtotal</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtHours(wsTotals.hours)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtUSD(wsTotals.billing)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{wsTotals.rate > 0 ? `${fmtUSD(wsTotals.rate)}/h` : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">100%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== Section 7 — Bottom row ===== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left — Top Contributors */}
          <div className="flex flex-col">
            <SectionLabel>Top Contributors by Hours</SectionLabel>
            <div className="border border-black/10 rounded-md p-4 space-y-2.5 flex-1">
              {topContributors.length === 0 && (
                <div className="text-xs text-muted-foreground py-6 text-center">No contributor data.</div>
              )}
              {(() => {
                const maxHours = Math.max(...topContributors.map(c => c.hours), 1);
                return topContributors.map(c => {
                  const w = Math.max((c.hours / maxHours) * 100, 2);
                  return (
                    <div key={c.name} className="flex items-center gap-3 text-sm">
                      <div className="w-44 truncate capitalize" title={c.name}>{c.name.toLowerCase()}</div>
                      <div className="flex-1 h-2 bg-black/[0.06] rounded-sm overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${w}%`, background: 'var(--client-accent, hsl(225 70% 35%))' }} />
                      </div>
                      <div className="w-16 text-right text-muted-foreground tabular-nums">{fmtHours(c.hours)}</div>
                      <div className="w-16 text-right font-medium tabular-nums">{fmtKUSD(c.billing)}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Right — Workstream by Task (collapsible, top 8 + show all) */}
          <div className="flex flex-col">
            <SectionLabel>Workstream by Task</SectionLabel>
            <div className="border border-black/10 rounded-md divide-y divide-black/5 flex-1 max-h-[640px] overflow-y-auto">
              {workstreamTasks.map(ws => {
                const isOpen = openGroups.has(ws.name);
                const tint = colorFor(ws.name);
                const showAll = expandedAll.has(ws.name);
                const visibleTasks = showAll ? ws.tasks : ws.tasks.slice(0, 8);
                const extra = ws.tasks.length - visibleTasks.length;
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
                      <span className="text-muted-foreground tabular-nums">{fmtHours(ws.hours)}</span>
                      <span className="font-semibold w-24 text-right tabular-nums">{fmtUSD(ws.billing)}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 pt-1 space-y-1.5">
                        {ws.tasks.length === 0 && (
                          <div className="text-xs text-muted-foreground py-2">No tasks in range.</div>
                        )}
                        {visibleTasks.map(t => {
                          const share = ws.billing > 0 ? (t.billing / ws.billing) * 100 : 0;
                          return (
                            <div key={t.task_name} className="flex items-center gap-3 text-[13px]">
                              <div className="w-48 truncate text-foreground/90" title={t.task_name}>{t.task_name}</div>
                              <div className="flex-1 h-1.5 bg-black/[0.05] rounded-sm overflow-hidden">
                                <div className="h-full" style={{ width: `${share}%`, background: tint }} />
                              </div>
                              <div className="w-14 text-right text-muted-foreground tabular-nums">{fmtHours(t.hours)}</div>
                              <div className="w-20 text-right tabular-nums">{fmtUSD(t.billing)}</div>
                            </div>
                          );
                        })}
                        {extra > 0 && (
                          <button
                            onClick={() => toggleAll(ws.name)}
                            className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground mt-1"
                          >
                            Show all ({ws.tasks.length})
                          </button>
                        )}
                        {showAll && ws.tasks.length > 8 && (
                          <button
                            onClick={() => toggleAll(ws.name)}
                            className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground mt-1"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== Admin-only portfolio view ===== */}
        {isAdmin && portfolio && portfolio.length > 0 && (
          <PortfolioSection rows={portfolio} />
        )}

      </div>
    </DataStateWrapper>
  );
};

/* ------------------------------------------------------------------------- */
/*  Render helpers                                                            */
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
  label, months, get, total, signed, isLast, dashWhen,
}: {
  label: string;
  months: string[];
  get: (m: string) => number;
  total: number;
  signed?: boolean;
  isLast?: boolean;
  dashWhen?: (m: string) => boolean;
}) => (
  <tr className={isLast ? 'border-t border-black/10' : 'border-t border-black/5'}>
    <td className="px-4 py-2.5 font-medium">{label}</td>
    {months.map(m => {
      if (dashWhen?.(m)) {
        return (
          <td key={m} className="px-4 py-2.5 text-right tabular-nums text-muted-foreground/60">—</td>
        );
      }
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

/* Simple paired-bar chart — pure SVG/divs, no recharts. */
const MonthlyBarChart = ({
  months, get,
}: {
  months: string[];
  get: (m: string) => { budget: number | null; worked: number };
}) => {
  const data = months.map(m => ({ m, ...get(m) }));
  const max = Math.max(1, ...data.flatMap(d => [d.budget ?? 0, d.worked]));
  return (
    <div className="border border-black/10 rounded-md p-4">
      <div className="flex items-end gap-4 h-44">
        {data.map(d => {
          const bH = d.budget == null ? 0 : (d.budget / max) * 100;
          const wH = (d.worked / max) * 100;
          const over = d.budget != null && d.worked > d.budget;
          return (
            <div key={d.m} className="flex-1 flex flex-col items-center gap-1 h-full">
              <div className="flex-1 w-full flex items-end justify-center gap-1">
                <div
                  className="w-1/2 rounded-sm"
                  style={{ height: `${bH}%`, background: d.budget == null ? 'transparent' : 'hsl(0 0% 75%)', border: d.budget == null ? '1px dashed hsl(0 0% 70%)' : undefined }}
                  title={d.budget == null ? 'Budget not yet loaded' : `Budget: ${fmtUSD(d.budget)}`}
                />
                <div
                  className="w-1/2 rounded-sm"
                  style={{ height: `${wH}%`, background: over ? RED : BLUE }}
                  title={`Worked: ${fmtUSD(d.worked)}`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{monthLabel(d.m)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'hsl(0 0% 75%)' }} /> Budget</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: BLUE }} /> Worked</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: RED }} /> Over budget</span>
      </div>
    </div>
  );
};

/* Admin portfolio — current-month view across all clients. */
const PortfolioSection = ({ rows }: { rows: PortfolioRow[] }) => {
  // Sort: largest over-service first (most negative budget_remaining).
  const sorted = useMemo(() => {
    return rows.slice().sort((a, b) => {
      const ar = a.budget_remaining ?? Infinity;
      const br = b.budget_remaining ?? Infinity;
      return ar - br;
    });
  }, [rows]);
  return (
    <section>
      <SectionLabel>All Clients — Current Month (Admin)</SectionLabel>
      <div className="border border-black/10 rounded-md overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="bg-black/[0.03] text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-right px-4 py-2 font-medium">Budget</th>
                <th className="text-right px-4 py-2 font-medium">Worked</th>
                <th className="text-right px-4 py-2 font-medium">Remaining</th>
                <th className="text-right px-4 py-2 font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const rem = r.budget_remaining;
                const over = rem != null && rem < 0;
                const util = r.utilization_pct ?? 0;
                return (
                  <tr key={r.supabase_client_id + r.budget_month} className="border-t border-black/5">
                    <td className="px-4 py-2">{r.client_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.monthly_budget == null ? '—' : fmtUSD(r.monthly_budget)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtUSD(r.billable_value)}</td>
                    <td className="px-4 py-2 text-right tabular-nums" style={{ color: rem == null ? undefined : over ? RED : GREEN }}>
                      {rem == null ? '—' : fmtUSDsigned(rem)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums" style={{ color: util > 100 ? RED : undefined }}>
                      {r.utilization_pct == null ? '—' : fmtPct(util)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ResourceManagementTab;
