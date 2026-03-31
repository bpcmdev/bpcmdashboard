import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  positiveDrivers: string;
  negativeThemes: string;
}

const fallback: SentimentData = {
  positive: 58,
  neutral: 31,
  negative: 11,
  positiveDrivers: 'Frank B, Hydro Grip launch, Ulta expansion',
  negativeThemes: 'prior sales decline coverage, pricing',
};

const SentimentBreakdown = () => {
  const [data, setData] = useState<SentimentData>(fallback);
  const { selectedWeek } = useWeek();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetch = async () => {
      const { data: row } = await supabase
        .from('weekly_snapshots')
        .select('sentiment_positive_pct, sentiment_neutral_pct, sentiment_negative_pct, positive_drivers, negative_themes')
        .eq('week_start', selectedWeek)
        .maybeSingle();

      if (row) {
        setData({
          positive: row.sentiment_positive_pct ?? fallback.positive,
          neutral: row.sentiment_neutral_pct ?? fallback.neutral,
          negative: row.sentiment_negative_pct ?? fallback.negative,
          positiveDrivers: row.positive_drivers ?? fallback.positiveDrivers,
          negativeThemes: row.negative_themes ?? fallback.negativeThemes,
        });
      } else {
        setData(fallback);
      }
    };
    fetch();
  }, [selectedWeek]);

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Sentiment Breakdown
      </h3>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Positive</span>
            <span className="text-xs font-bold">{data.positive}%</span>
          </div>
          <div className="h-5 bg-secondary w-full">
            <div className="h-full bg-foreground" style={{ width: `${data.positive}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Neutral</span>
            <span className="text-xs font-bold">{data.neutral}%</span>
          </div>
          <div className="h-5 bg-secondary w-full">
            <div className="h-full bg-muted-foreground/50" style={{ width: `${data.neutral}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Negative</span>
            <span className="text-xs font-bold">{data.negative}%</span>
          </div>
          <div className="h-5 bg-secondary w-full">
            <div className="h-full bg-destructive" style={{ width: `${data.negative}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Positive drivers:</span> {data.positiveDrivers}
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Negative themes:</span> {data.negativeThemes}
        </p>
      </div>
    </div>
  );
};

export default SentimentBreakdown;
