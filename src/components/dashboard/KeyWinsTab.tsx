import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import PlaceholderCard from './PlaceholderCard';
import DeleteEntryButton from './DeleteEntryButton';
import EditKeyWinDialog from './EditKeyWinDialog';
import CategoryLabel, { categoryClass } from './CategoryLabel';

interface KeyWin {
  id: string;
  title: string;
  category: string;
  description: string;
  reach: string;
  tier: string;
}

const PAGE_SIZE = 10;

const KeyWinsTab = () => {
  const { refreshKey, activeClientId: clientId } = useWeek();
  const { isAdmin } = useAdmin();
  const [wins, setWins] = useState<KeyWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [page, setPage] = useState(1);

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

  // Reset to page 1 when category filter changes
  useEffect(() => { setPage(1); }, [activeCategory]);

  const categories = ['ALL', ...Array.from(new Set(wins.map(w => w.category).filter(Boolean)))];
  const filtered = activeCategory === 'ALL' ? wins : wins.filter(w => w.category === activeCategory);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Group paginated by category (for ALL view)
  const grouped: Record<string, KeyWin[]> = {};
  for (const w of paginated) {
    const cat = w.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(w);
  }

  const columns = Object.entries(grouped);
  const totalCards = paginated.length;
  const placeholders = activeCategory === 'ALL' ? Math.max(0, 3 - totalCards) : 0;

  const renderCard = (card: KeyWin) => (
    <div key={card.id} className={`entry-card ${categoryClass(card.category)} bg-card border border-border p-5 relative`}>
      {isAdmin && <div className="absolute top-3 right-3 flex items-center gap-1"><EditKeyWinDialog entry={card} /><DeleteEntryButton table="key_wins" id={card.id} label="this win" /></div>}
      <div className="mb-3">
        <CategoryLabel category={card.category} />
      </div>
      <h4 className="text-sm font-bold text-foreground mb-2">{card.title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{card.description}</p>
      <div className="border-t border-border pt-3">
        <p className="text-[11px] text-muted-foreground">
          {[card.reach, card.tier].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );

  return (
    <DataStateWrapper loading={loading} error={error}>
      {wins.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground py-24">
          No key wins yet. Add entries via the Admin panel.
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="section-label">Key Wins This Week</span>
            <span className="section-count text-base">
              {activeCategory === 'ALL' ? wins.length : filtered.length} of {wins.length} wins
            </span>
          </div>

          {/* Category filter bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '6px 12px',
                    border: isActive ? '1px solid rgba(201,160,60,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    color: isActive ? 'hsl(var(--chart-gold))' : 'rgba(255,255,255,0.4)',
                    background: isActive ? 'rgba(201,160,60,0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {activeCategory === 'ALL' ? (
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(columns.length, 1), 3)}, 1fr)` }}>
              {columns.map(([category, cards]) => (
                <div key={category} className="space-y-4">
                  {cards.map(renderCard)}
                </div>
              ))}
              {Array.from({ length: placeholders }).map((_, i) => (
                <PlaceholderCard key={`ph-${i}`} />
              ))}
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {paginated.map(renderCard)}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(255,255,255,0.08)', background: 'none', color: page === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                ← Prev
              </button>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(255,255,255,0.08)', background: 'none', color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </DataStateWrapper>
  );
};

export default KeyWinsTab;
