import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';

const FALLBACK_TEXT = "No narrative alerts this week.";

const NarrativeTicker = () => {
  const { activeClientId, selectedWeek, refreshKey } = useWeek();
  const [tickerText, setTickerText] = useState(FALLBACK_TEXT);

  useEffect(() => {
    if (!activeClientId) {
      setTickerText(FALLBACK_TEXT);
      return;
    }
    let cancelled = false;
    const fetchNarrative = async () => {
      // 1. Try the currently selected week first
      if (selectedWeek) {
        const { data: weekData, error: weekErr } = await supabase
          .from('weekly_snapshots')
          .select('narrative_watch')
          .eq('client_id', activeClientId)
          .eq('week_start', selectedWeek)
          .maybeSingle();
        if (cancelled) return;
        if (weekErr) {
          console.error('[NarrativeTicker] selected-week fetch error:', weekErr);
        }
        const text = weekData?.narrative_watch?.trim();
        if (text) {
          setTickerText(text);
          return;
        }
      }
      // 2. Fall back to most recent non-null narrative_watch for this client
      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('narrative_watch, week_start')
        .eq('client_id', activeClientId)
        .not('narrative_watch', 'is', null)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[NarrativeTicker] fallback fetch error:', error);
        setTickerText(FALLBACK_TEXT);
        return;
      }
      setTickerText(data?.narrative_watch?.trim() || FALLBACK_TEXT);
    };
    fetchNarrative();
    return () => { cancelled = true; };
  }, [activeClientId, selectedWeek, refreshKey]);

  return (
    <div className="dashboard-ticker px-6 py-2.5 flex items-center gap-4 overflow-hidden">
      <span className="shrink-0 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 text-positive border border-accent/30" style={{ backgroundColor: 'hsla(145, 63%, 42%, 0.2)' }}>
        NARRATIVE WATCH
      </span>
      <div className="overflow-hidden flex-1">
        <div className="animate-ticker whitespace-nowrap inline-block">
          <span className="text-xs tracking-wide mr-24">{tickerText}</span>
          <span className="text-xs tracking-wide mr-24">{tickerText}</span>
        </div>
      </div>
    </div>
  );
};

export default NarrativeTicker;
