import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek, applyWeekStartFilter } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface QueryRow {
  query_text: string;
  category: string;
  search_volume: number;
  sov_pct: number | null;
}

const TopQueriesSovView = () => {
  const { selectedWeek, activeClientId, refreshKey, weekFilterCtx } = useWeek();
  const { clientName } = useAdmin();
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeClientId) { setQueries([]); setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      let query = supabase
        .from('ai_top_queries')
        .select('query_text, category, search_volume, sov_pct')
        .eq('client_id', activeClientId);
      query = applyWeekStartFilter(query, weekFilterCtx);
      const { data, error } = await query.order('search_volume', { ascending: false });

      if (error) {
        console.error('TopQueriesSov fetch error:', error);
        setQueries([]);
      } else {
        setQueries((data ?? []).map((r: any) => ({
          query_text: r.query_text ?? '',
          category: r.category ?? '',
          search_volume: r.search_volume ?? 0,
          sov_pct: r.sov_pct ?? null,
        })));
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedWeek, activeClientId, refreshKey, weekFilterCtx]);

  const toggleCategory = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-card border border-border p-5 space-y-3">
        <Skeleton className="h-5 w-64" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="bg-card border border-border p-5">
        <p className="text-sm text-muted-foreground text-center py-6">No query data for this week.</p>
      </div>
    );
  }

  const categories = [...new Set(queries.map(q => q.category).filter(Boolean))].sort();
  const ungrouped = queries.filter(q => !q.category);

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">
        Top Queries + SOV — {clientName ?? 'Brand'}
      </h3>
      <p className="text-[10px] text-muted-foreground mb-4">Queries grouped by category with share-of-voice data</p>

      <div className="space-y-1">
        {categories.map(cat => {
          const catQueries = queries.filter(q => q.category === cat);
          const isOpen = expanded.has(cat);
          return (
            <div key={cat} className="border border-border">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-xs font-bold uppercase tracking-[0.05em]">{cat}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{catQueries.length} queries</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-border border-t border-border">
                  <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/30">
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground w-6 text-right">#</span>
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground flex-1">Query</span>
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground w-24 text-right">Volume</span>
                    <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground w-16 text-right">SOV %</span>
                  </div>
                  {catQueries.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-4 px-4 py-2.5">
                      <span className="text-sm font-bold w-6 text-right text-muted-foreground">{idx + 1}</span>
                      <span className="text-sm font-medium flex-1">"{q.query_text}"</span>
                      <span className="text-[11px] text-muted-foreground w-24 text-right">
                        {q.search_volume > 0 ? q.search_volume.toLocaleString() : '—'}
                      </span>
                      <span className="text-[11px] font-medium w-16 text-right">
                        {q.sov_pct != null ? `${q.sov_pct}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="border border-border">
            <button
              onClick={() => toggleCategory('__ungrouped')}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              {expanded.has('__ungrouped') ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-bold uppercase tracking-[0.05em]">Uncategorized</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{ungrouped.length} queries</span>
            </button>
            {expanded.has('__ungrouped') && (
              <div className="divide-y divide-border border-t border-border">
                {ungrouped.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-4 py-2.5">
                    <span className="text-sm font-bold w-6 text-right text-muted-foreground">{idx + 1}</span>
                    <span className="text-sm font-medium flex-1">"{q.query_text}"</span>
                    <span className="text-[11px] text-muted-foreground w-24 text-right">
                      {q.search_volume > 0 ? q.search_volume.toLocaleString() : '—'}
                    </span>
                    <span className="text-[11px] font-medium w-16 text-right">
                      {q.sov_pct != null ? `${q.sov_pct}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopQueriesSovView;
