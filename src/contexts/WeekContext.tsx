import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface WeekOption {
  label: string;
  weekStart: string;
}

interface WeekContextType {
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
  weeks: WeekOption[];
  loading: boolean;
  lastUpdated: Date | null;
  refreshData: () => void;
  refreshKey: number;
}

const WeekContext = createContext<WeekContextType>({
  selectedWeek: '',
  setSelectedWeek: () => {},
  weeks: [],
  loading: true,
  lastUpdated: null,
  refreshData: () => {},
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

export const WeekProvider = ({ children }: { children: ReactNode }) => {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshData = () => {
    setRefreshKey(k => k + 1);
    setLastUpdated(new Date());
  };

  // Track when selectedWeek changes to update lastUpdated
  useEffect(() => {
    if (selectedWeek) {
      setLastUpdated(new Date());
    }
  }, [selectedWeek, refreshKey]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('weekly_snapshots')
        .select('week_start')
        .order('week_start', { ascending: false })
        .limit(12);

      let weekOptions: WeekOption[];
      if (data && data.length > 0) {
        weekOptions = data.map((row: any) => {
          const start = new Date(row.week_start + 'T00:00:00');
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
          const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
          const startDay = start.getDate();
          const endDay = end.getDate();
          const year = end.getFullYear();
          const label = startMonth === endMonth
            ? `${startMonth} ${startDay}–${endDay}, ${year}`
            : `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
          return { label, weekStart: row.week_start };
        });
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
    init();
  }, []);

  return (
    <WeekContext.Provider value={{ selectedWeek, setSelectedWeek, weeks, loading, lastUpdated, refreshData }}>
      {children}
    </WeekContext.Provider>
  );
};
