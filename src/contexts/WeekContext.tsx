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

function generateLast12Weeks(): WeekOption[] {
  const weeks: WeekOption[] = [];
  const baseDate = new Date('2026-03-23T00:00:00');
  for (let i = 0; i < 12; i++) {
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() - i * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);

    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    const label = startMonth === endMonth
      ? `${startMonth} ${startDay}–${endDay}, ${year}`
      : `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;

    const iso = startDate.toISOString().split('T')[0];
    weeks.push({ label, weekStart: iso });
  }
  return weeks;
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
        .order('week_start', { ascending: false });

      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      }

      const { data } = await query;

      let weekOptions: WeekOption[];
      if (data && data.length > 0) {
        const seen = new Set<string>();
        const unique = data.filter((row: any) => {
          if (seen.has(row.week_start)) return false;
          seen.add(row.week_start);
          return true;
        });
        weekOptions = unique.map((row: any) => ({
          label: formatWeekLabel(row.week_start),
          weekStart: row.week_start,
        }));
      } else {
        weekOptions = generateLast12Weeks();
      }

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
