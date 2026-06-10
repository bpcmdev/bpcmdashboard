import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface WeekOption {
  label: string;
  weekStart: string;
}

export type DateRangeMode = 'week' | 'range';

export const ALL_TIME_VALUE = 'all-time';

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
}

const WeekContext = createContext<WeekContextType>({
  selectedWeek: ALL_TIME_VALUE,
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
  isAllTime: true,
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
  const [selectedWeek, setSelectedWeek] = useState<string>(ALL_TIME_VALUE);
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
      let query = supabase
        .from('weekly_snapshots')
        .select('week_start')
        .order('week_start', { ascending: true });

      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      }

      const { data } = await query;

      // Earliest week we ever want to show: Jan 2026, or earlier if the client has older data.
      const DEFAULT_START = '2026-01-05'; // first Monday of 2026
      let earliest = DEFAULT_START;
      if (data && data.length > 0) {
        const earliestRow = (data[0] as { week_start: string }).week_start;
        if (earliestRow && earliestRow < earliest) earliest = earliestRow;
      }

      // Build a continuous Monday-by-Monday calendar so weeks with no snapshot
      // are still selectable (empty states render per-tab).
      const weekOptions = generateCalendarWeeks(earliest);

      // Always prepend the synthetic "All Time" option so it's the default + always available.
      const withAllTime: WeekOption[] = [{ label: 'All Time', weekStart: ALL_TIME_VALUE }, ...weekOptions];
      setWeeks(withAllTime);
      setLastUpdated(new Date());
      setLoading(false);
    };
    fetchWeeks();
  }, [activeClientId, userClientId]);

  const isAllTime = rangeMode === 'week' && (selectedWeek === ALL_TIME_VALUE || !selectedWeek);

  let effectiveFrom = '';
  let effectiveTo = '';
  if (rangeMode === 'range' && rangeFrom && rangeTo) {
    effectiveFrom = rangeFrom;
    effectiveTo = rangeTo;
  } else if (!isAllTime && selectedWeek) {
    const end = new Date(selectedWeek + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    effectiveFrom = selectedWeek;
    effectiveTo = end.toISOString().split('T')[0];
  }

  return (
    <WeekContext.Provider value={{
      selectedWeek, setSelectedWeek, weeks, loading, lastUpdated, refreshData, refreshKey,
      overrideClientId, setOverrideClientId, activeClientId,
      rangeMode, setRangeMode, rangeFrom, rangeTo, setRangeFrom, setRangeTo,
      effectiveFrom, effectiveTo, isAllTime,
    }}>
      {children}
    </WeekContext.Provider>
  );
};
