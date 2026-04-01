import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Skeleton } from '@/components/ui/skeleton';

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  positiveDrivers: string;
  negativeThemes: string;
}

const SentimentBreakdown = () => {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { selectedWeek, refreshKey } = useWeek();

  useEffect(() => {
    if (!selectedWeek) return;
    const fetchSentiment = async () => {
      setLoading(true);
      setError(false);
      const { data: row, error: err } = await supabase
        .from('weekly_snapshots')
        .select('sentiment_score')
        .eq('week_start', selectedWeek)
        .maybeSingle();

      if (err) {
        console.error('Failed to fetch sentiment:', err);
        setError(true);
        setLoading(false);
        return;
      }

      if (row && row.sentiment_score != null) {
        const score = row.sentiment_score;
        const positive = Math.round(score * 0.8);
        const negative = Math.round((100 - score) * 0.4);
        const neutral = 100 - positive - negative;
        setData({
          positive,
          neutral: Math.max(0, neutral),
          negative,
          positiveDrivers: 'Frank B, Hydro Grip launch, Ulta expansion',
          negativeThemes: 'prior sales decline coverage, pricing',
        });
      } else {
        setData({ positive: 0, neutral: 0, negative: 0, positiveDrivers: '—', negativeThemes: '—' });
      }
      setLoading(false);
    };
    fetchSentiment();
  }, [selectedWeek, refreshKey]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  const bars = [
    { label: 'Positive', pct: data.positive, barClass: 'bg-foreground' },
    { label: 'Neutral', pct: data.neutral, barClass: 'bg-muted-foreground/50' },
    { label: 'Negative', pct: data.negative, barClass: 'bg-destructive' },
  ];

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Sentiment Breakdown
      </h3>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{b.label}</span>
              <span className="text-xs font-bold">{b.pct}%</span>
            </div>
            <div className="h-5 bg-secondary w-full">
              <div className={`h-full ${b.barClass}`} style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
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
