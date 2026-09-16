import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';

interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
  classified: number;
  total: number;
}

const SentimentBreakdown = () => {
  const [counts, setCounts] = useState<SentimentCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { refreshKey, activeClientId, effectiveFrom, effectiveTo, isAllTime } = useWeek();

  useEffect(() => {
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;

    const fetchSentiment = async () => {
      setLoading(true);
      setError(false);

      let query = supabase.from('placements').select('sentiment');
      if (!isAllTime) {
        query = query.gte('published_at', effectiveFrom).lte('published_at', effectiveTo);
      }
      if (activeClientId) query = query.eq('client_id', activeClientId);

      const { data: rows, error: err } = await query;

      if (err) {
        console.error('Failed to fetch sentiment:', err);
        setError(true);
        setLoading(false);
        return;
      }

      const list = rows ?? [];
      const tally = { positive: 0, neutral: 0, negative: 0 };
      list.forEach((r: any) => {
        const s = typeof r.sentiment === 'string' ? r.sentiment.toLowerCase() : null;
        if (s === 'positive' || s === 'neutral' || s === 'negative') tally[s] += 1;
      });

      setCounts({
        ...tally,
        classified: tally.positive + tally.neutral + tally.negative,
        total: list.length,
      });
      setLoading(false);
    };

    fetchSentiment();
  }, [effectiveFrom, effectiveTo, isAllTime, refreshKey, activeClientId]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-8">Unable to load data. Please try refreshing.</p>;
  }

  if (loading || !counts) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-3 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="shimmer h-2.5 w-16" />
                <div className="shimmer h-2.5 w-8" />
              </div>
              <div className="shimmer h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (counts.classified === 0) {
    return (
      <div>
        <h3 className="section-label mb-4">Sentiment Breakdown</h3>
        <div className="py-8">
          <p className="text-xs text-foreground/80 leading-relaxed">
            Sentiment analysis not yet available — awaiting classification.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
            Sentiment isn&apos;t included in the current Launchmetrics tier, so none of the
            {counts.total > 0 ? ` ${counts.total.toLocaleString()} placement${counts.total !== 1 ? 's' : ''} in this range have` : ' placements have'}{' '}
            a sentiment value recorded.
          </p>
        </div>
      </div>
    );
  }

  const bars = [
    { label: 'Positive', value: counts.positive, barColor: 'hsl(225 70% 35%)' },
    { label: 'Neutral', value: counts.neutral, barColor: 'hsl(0 0% 60%)' },
    { label: 'Negative', value: counts.negative, barColor: 'hsl(0 70% 50%)' },
  ];

  return (
    <div>
      <h3 className="section-label mb-4">Sentiment Breakdown</h3>
      <div className="space-y-3">
        {bars.map((b, i) => {
          const pct = Math.round((b.value / counts.classified) * 100);
          return (
            <div key={b.label} className="stagger-in" style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{b.label}</span>
                <span className="text-xs font-bold text-foreground">
                  {pct}% <span className="font-normal text-muted-foreground">({b.value.toLocaleString()})</span>
                </span>
              </div>
              <div className="h-5 bg-secondary w-full rounded-sm overflow-hidden">
                <div
                  className="h-full transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%`, background: b.barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {counts.total > counts.classified && (
        <p className="text-[11px] text-muted-foreground mt-4">
          Based on {counts.classified.toLocaleString()} of {counts.total.toLocaleString()} placements — the rest have no
          sentiment recorded.
        </p>
      )}
    </div>
  );
};

export default SentimentBreakdown;
