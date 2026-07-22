import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import DeleteEntryButton from './DeleteEntryButton';
import EditKeyWinDialog from './EditKeyWinDialog';
import EmptyState from './EmptyState';
import { formatReach } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KeyWin {
  id: string;
  title: string;
  category: string;
  description: string;
  reach: string;
  tier: string;
}

const PAGE_SIZE = 10;

const CATEGORY_BADGE: Record<string, { bg: string; color: string }> = {
  'EARNED MEDIA':         { bg: 'hsl(225,70%,35%)', color: '#ffffff' },
  'INFLUENCER & SOCIAL':  { bg: '#7C3AED',          color: '#ffffff' },
  'CORPORATE COMMS':      { bg: '#1D4ED8',          color: '#ffffff' },
  'BRAND PARTNERSHIP':    { bg: '#047857',          color: '#ffffff' },
  'NARRATIVE WATCH':      { bg: 'hsl(42,64%,45%)',  color: '#ffffff' },
};

const CATEGORY_BORDER_CLASS: Record<string, string> = {
  'EARNED MEDIA':        'cat-earned',
  'INFLUENCER & SOCIAL': 'cat-influencer',
  'CORPORATE COMMS':     'cat-corporate',
  'BRAND PARTNERSHIP':   'cat-partnership',
};

function getBadgeStyle(category: string): React.CSSProperties {
  const key = (category || '').toUpperCase();
  const c = CATEGORY_BADGE[key] ?? { bg: 'hsl(0,0%,15%)', color: '#ffffff' };
  return { background: c.bg, color: c.color };
}

function getCategoryClass(category: string): string {
  return CATEGORY_BORDER_CLASS[(category || '').toUpperCase()] ?? 'cat-default';
}

const KeyWinsTab = () => {
  const { refreshKey, activeClientId: clientId, isAllTime, effectiveFrom, effectiveTo } = useWeek();
  const { isAdmin } = useAdmin();
  const [wins, setWins] = useState<KeyWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!clientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    const fetch = async () => {
      setLoading(true);
      setError(false);
      let q = supabase
        .from('key_wins')
        .select('*')
        .eq('client_id', clientId);
      if (!isAllTime) {
        q = q
          .gte('created_at', effectiveFrom)
          .lte('created_at', `${effectiveTo}T23:59:59.999Z`);
      }
      const { data, error: err } = await q.order('created_at', { ascending: false });
      if (err) {
        console.error('[KeyWinsTab] error:', err);
        setError(true);
      }
      setWins(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId, refreshKey, isAllTime, effectiveFrom, effectiveTo]);

  const categories = ['ALL', ...Array.from(new Set(wins.map(w => w.category).filter(Boolean)))];
  const filtered = activeCategory === 'ALL' ? wins : wins.filter(w => w.category === activeCategory);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataStateWrapper loading={loading} error={error}>
      {wins.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No key wins yet"
          description="Add entries via the Admin panel or upload a weekly document."
        />
      ) : (
        <div className="p-6">

          {/* Category filter bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setPage(1); }}
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '5px 12px',
                  border: activeCategory === cat
                    ? '1px solid rgba(201,160,60,0.5)'
                    : '1px solid rgba(0,0,0,0.1)',
                  background: activeCategory === cat
                    ? 'rgba(201,160,60,0.12)'
                    : 'transparent',
                  color: activeCategory === cat
                    ? 'hsl(42 64% 38%)'
                    : 'hsl(0 0% 40%)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Section header with count */}
          <div className="flex items-center justify-between mb-4">
            <span className="section-label">Key Wins This Week</span>
            <span className="section-count">{filtered.length} of {wins.length}</span>
          </div>

          {/* Flat 3-column grid */}
          <TooltipProvider delayDuration={200}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {paginated.map((card) => {
                const desc = card.description ?? '';
                const isLong = desc.length > 120;
                const isOpen = !!expanded[card.id];
                const showDesc = isLong && !isOpen ? desc.slice(0, 120).trim() + '…' : desc;
                return (
                  <div
                    key={card.id}
                    className={`entry-card ${getCategoryClass(card.category)} bg-card border border-black/10 p-5 relative cursor-pointer`}
                  >
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <EditKeyWinDialog entry={card} />
                        <DeleteEntryButton table="key_wins" id={card.id} label="this win" />
                      </div>
                    )}
                    <span
                      className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 mb-3"
                      style={getBadgeStyle(card.category)}
                    >
                      {card.category}
                    </span>
                    <h4 className="text-sm font-bold text-foreground mb-2">{card.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{showDesc}</p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setExpanded(prev => ({ ...prev, [card.id]: !isOpen }))}
                        className="text-[11px] font-medium mb-3"
                        style={{ color: 'hsl(225,70%,35%)' }}
                      >
                        {isOpen ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    <div className="border-t border-black/10 pt-3 mt-2">
                      <p className="text-[11px] text-muted-foreground">
                        {card.reach && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{formatReach(card.reach)}</span>
                            </TooltipTrigger>
                            <TooltipContent>Reach: {card.reach}</TooltipContent>
                          </Tooltip>
                        )}
                        {card.reach && card.tier && ' · '}
                        {card.tier}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(0,0,0,0.1)', background: 'none', color: page === 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                ← Prev
              </button>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(0,0,0,0.1)', background: 'none', color: page === totalPages ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
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
