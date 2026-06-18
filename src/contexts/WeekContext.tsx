import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface WeekOption {
  label: string;
  weekStart: string;
}

export type DateRangeMode = 'week' | 'range';

export const ALL_TIME_VALUE = 'all-time';
export const YTD_VALUE = 'ytd';

/** First day of the current calendar year, ISO (YYYY-01-01). */
function currentYearStartIso(): string {
  const y = new Date().getFullYear();
  return `${y}-01-01`;
}

export interface WeekFilterCtx {
  isAllTime: boolean;
  isYTD: boolean;
  ytdFrom: string;
  rangeMode: DateRangeMode;
  rangeFrom: string;
  rangeTo: string;
  selectedWeek: string;
}

/**
 * Apply the current period selection to a Supabase query that filters on `week_start`.
 *  - All Time  → no filter
 *  - YTD       → gte(week_start, Jan 1 of current year)
 *  - Range     → gte/lte the chosen range
 *  - Week      → eq the exact week start
 */
export function applyWeekStartFilter<Q extends { eq: any; gte: any; lte: any }>(query: Q, ctx: WeekFilterCtx): Q {
  if (ctx.rangeMode === 'range' && ctx.rangeFrom && ctx.rangeTo) {
    return query.gte('week_start', ctx.rangeFrom).lte('week_start', ctx.rangeTo);
  }
  if (ctx.isAllTime) return query;
  if (ctx.isYTD) return query.gte('week_start', ctx.ytdFrom);
  if (ctx.selectedWeek) return query.eq('week_start', ctx.selectedWeek);
  return query;
}

interface WeekContextType {
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
  weeks: WeekOption[];
  loading: boolean;
  lastUpdated: Date | null;
  refreshData: () => void;
  refreshKey: number;
  overrideClientId: string | null;
  setOverrideClientId: (id: string | null) => void;
  activeClientId: string | null;
  rangeMode: DateRangeMode;
  setRangeMode: (m: DateRangeMode) => void;
  rangeFrom: string;
  rangeTo: string;
  setRangeFrom: (d: string) => void;
  setRangeTo: (d: string) => void;
  /** Effective start/end derived from week or custom range — empty strings when in All Time mode. */
  effectiveFrom: string;
  effectiveTo: string;
  /** True when the dashboard should aggregate all-time data (no date filter). */
  isAllTime: boolean;
  /** True when the dashboard should aggregate year-to-date data (week_start >= Jan 1 of current year). */
  isYTD: boolean;
  /** First day of the current calendar year — the lower bound used for YTD queries. */
  ytdFrom: string;
  /** Snapshot of all fields needed to drive applyWeekStartFilter. */
  weekFilterCtx: WeekFilterCtx;
}

const WeekContext = createContext<WeekContextType>({
  selectedWeek: YTD_VALUE,
  setSelectedWeek: () => {},
  weeks: [],
  loading: true,
  lastUpdated: null,
  refreshData: () => {},
  refreshKey: 0,
  overrideClientId: null,
  setOverrideClientId: () => {},
  activeClientId: null,
  rangeMode: 'week',
  setRangeMode: () => {},
  rangeFrom: '',
  rangeTo: '',
  setRangeFrom: () => {},
  setRangeTo: () => {},
  effectiveFrom: '',
  effectiveTo: '',
  isAllTime: false,
  isYTD: true,
  ytdFrom: currentYearStartIso(),
  weekFilterCtx: {
    isAllTime: false,
    isYTD: true,
    ytdFrom: currentYearStartIso(),
    rangeMode: 'week',
    rangeFrom: '',
    rangeTo: '',
    selectedWeek: YTD_VALUE,
  },
});

export const useWeek = () => useContext(WeekContext);

/** Monday of the week containing `d` (local time). */
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();
  return startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}, ${year}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/** Generate every Monday-start week from `startIso` through the current week (descending). */
function generateCalendarWeeks(startIso: string): WeekOption[] {
  const start = mondayOf(new Date(startIso + 'T00:00:00'));
  const end = mondayOf(new Date());
  const weeks: WeekOption[] = [];
  const cursor = new Date(end);
  while (cursor >= start) {
    const iso = toIso(cursor);
    weeks.push({ label: formatWeekLabel(iso), weekStart: iso });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

export const WeekProvider = ({ children }: { children: ReactNode }) => {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(YTD_VALUE);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [overrideClientId, setOverrideClientId] = useState<string | null>(null);
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<DateRangeMode>('week');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const refreshData = () => {
    setRefreshKey(k => k + 1);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    if (selectedWeek) {
      setLastUpdated(new Date());
    }
  }, [selectedWeek, refreshKey]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('client_id')
          .eq('id', user.id)
          .maybeSingle();
        setUserClientId(profile?.client_id ?? null);
      }
    };
    fetchProfile();
  }, []);

  const activeClientId = overrideClientId ?? userClientId;

  useEffect(() => {
    if (activeClientId === null && userClientId === null) return;
    const fetchWeeks = async () => {
      setLoading(true);

      // Week dropdown is calendar-generated (NOT data-derived): every Monday-start
      // week from Jan 2025 through the current week. Identical for every client.
      // Weeks with no PR snapshot still render their per-tab empty states.
      const CALENDAR_START = '2025-01-06'; // first Monday of 2025
      const weekOptions = generateCalendarWeeks(CALENDAR_START);

      // Prepend the synthetic "Year-to-Date" (default) and "All Time" options so
      // they're always available at the top of the dropdown.
      const withSynthetic: WeekOption[] = [
        { label: 'Year-to-Date', weekStart: YTD_VALUE },
        { label: 'All Time', weekStart: ALL_TIME_VALUE },
        ...weekOptions,
      ];
      setWeeks(withSynthetic);
      setLastUpdated(new Date());
      setLoading(false);
    };
    fetchWeeks();
  }, [activeClientId, userClientId]);


  const isAllTime = rangeMode === 'week' && selectedWeek === ALL_TIME_VALUE;
  const isYTD = rangeMode === 'week' && selectedWeek === YTD_VALUE;
  const ytdFrom = currentYearStartIso();

  let effectiveFrom = '';
  let effectiveTo = '';
  if (rangeMode === 'range' && rangeFrom && rangeTo) {
    effectiveFrom = rangeFrom;
    effectiveTo = rangeTo;
  } else if (isYTD) {
    // YTD → first day of current year through today.
    effectiveFrom = ytdFrom;
    effectiveTo = toIso(new Date());
  } else if (!isAllTime && selectedWeek) {
    const end = new Date(selectedWeek + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    effectiveFrom = selectedWeek;
    effectiveTo = end.toISOString().split('T')[0];
  }

  const weekFilterCtx: WeekFilterCtx = {
    isAllTime, isYTD, ytdFrom, rangeMode, rangeFrom, rangeTo, selectedWeek,
  };

  return (
    <WeekContext.Provider value={{
      selectedWeek, setSelectedWeek, weeks, loading, lastUpdated, refreshData, refreshKey,
      overrideClientId, setOverrideClientId, activeClientId,
      rangeMode, setRangeMode, rangeFrom, rangeTo, setRangeFrom, setRangeTo,
      effectiveFrom, effectiveTo, isAllTime, isYTD, ytdFrom, weekFilterCtx,
    }}>
      {children}
    </WeekContext.Provider>
  );
};
