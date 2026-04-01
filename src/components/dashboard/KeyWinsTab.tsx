import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';

interface KeyWin {
  id: string;
  title: string;
  category: string;
  description: string;
  reach: string;
  tier: string;
}

const KeyWinsTab = () => {
  const { clientId } = useAdmin();
  const [wins, setWins] = useState<KeyWin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('key_wins')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) console.error('[KeyWinsTab] error:', error);
      setWins(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (wins.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground py-24">
        No key wins yet. Add entries via the Admin panel.
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, KeyWin[]> = {};
  for (const w of wins) {
    const cat = w.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  }

  const columns = Object.entries(grouped);

  return (
    <div className="p-6">
      <div className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, 1fr)` }}>
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
      </div>
    </div>
  );
};

export default KeyWinsTab;
