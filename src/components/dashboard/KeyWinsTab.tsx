import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import PlaceholderCard from './PlaceholderCard';
import DeleteEntryButton from './DeleteEntryButton';

interface KeyWin {
  id: string;
  title: string;
  category: string;
  description: string;
  reach: string;
  tier: string;
}

const KeyWinsTab = () => {
  const { refreshKey } = useWeek();
  const { clientId } = useAdmin();
  const [wins, setWins] = useState<KeyWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      setLoading(true);
      setError(false);
      const { data, error: err } = await supabase
        .from('key_wins')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (err) {
        console.error('[KeyWinsTab] error:', err);
        setError(true);
      }
      setWins(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId, refreshKey]);

  // Group by category
  const grouped: Record<string, KeyWin[]> = {};
  for (const w of wins) {
    const cat = w.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  }

  const columns = Object.entries(grouped);
  const totalCards = wins.length;
  const placeholders = Math.max(0, 3 - totalCards);

  return (
    <DataStateWrapper loading={loading} error={error}>
      {wins.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground py-24">
          No key wins yet. Add entries via the Admin panel.
        </div>
      ) : (
        <div className="p-6">
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(columns.length, 1), 3)}, 1fr)` }}>
            {columns.map(([category, cards]) => (
              <div key={category} className="space-y-4">
                {cards.map((card) => (
                  <div key={card.id} className="bg-card border border-border p-5">
                    <span className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 bg-foreground text-background mb-3">
                      {card.category}
                    </span>
                    <h4 className="text-sm font-bold text-foreground mb-2">{card.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{card.description}</p>
                    <div className="border-t border-border pt-3">
                      <p className="text-[11px] text-muted-foreground">
                        {[card.reach, card.tier].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {Array.from({ length: placeholders }).map((_, i) => (
              <PlaceholderCard key={`ph-${i}`} />
            ))}
          </div>
        </div>
      )}
    </DataStateWrapper>
  );
};

export default KeyWinsTab;
