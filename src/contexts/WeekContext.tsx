import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface WeekOption {
  label: string;
  weekStart: string;
}

export type DateRangeMode = 'week' | 'range';

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
  /** Earned Media date-range mode + bounds (YYYY-MM-DD). When mode='week', range mirrors selected week. */
  rangeMode: DateRangeMode;
  setRangeMode: (m: DateRangeMode) => void;
  rangeFrom: string;
  rangeTo: string;
  setRangeFrom: (d: string) => void;
  setRangeTo: (d: string) => void;
  /** Effective start/end derived from week or custom range — use these in queries. */
  effectiveFrom: string;
  effectiveTo: string;
}

const WeekContext = createContext<WeekContextType>({
  selectedWeek: '',
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
  const [selectedWeek, setSelectedWeek] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [overrideClientId, setOverrideClientId] = useState<string | null>(null);
  const [userClientId, setUserClientId] = useState<string | null>(null);

  const refreshData = () => {
    setRefreshKey(k => k + 1);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    if (selectedWeek) {
      setLastUpdated(new Date());
    }
  }, [selectedWeek, refreshKey]);

  // Fetch user's client_id once
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

  // Fetch weeks whenever active client changes
  const activeClientId = overrideClientId ?? userClientId;

  useEffect(() => {
    if (activeClientId === null && userClientId === null) return; // still loading
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

      setWeeks(weekOptions);
      if (weekOptions.length > 0) {
        setSelectedWeek(weekOptions[0].weekStart);
      }
      setLastUpdated(new Date());
      setLoading(false);
    };
    fetchWeeks();
  }, [activeClientId, userClientId]);

  return (
    <WeekContext.Provider value={{ selectedWeek, setSelectedWeek, weeks, loading, lastUpdated, refreshData, refreshKey, overrideClientId, setOverrideClientId, activeClientId }}>
      {children}
    </WeekContext.Provider>
  );
};
