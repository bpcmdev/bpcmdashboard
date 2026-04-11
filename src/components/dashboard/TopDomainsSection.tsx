import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import PaginationControls from './PaginationControls';

interface DomainRow {
  domain: string;
  classification: string;
  retrieved_percentage: number;
  citation_rate: number;
}

const TYPE_COLORS: Record<string, string> = {
  UGC: 'bg-blue-100 text-blue-800',
  EDITORIAL: 'bg-purple-100 text-purple-800',
  CORPORATE: 'bg-orange-100 text-orange-800',
  REFERENCE: 'bg-gray-100 text-gray-700',
  INSTITUTIONAL: 'bg-teal-100 text-teal-800',
  OTHER: 'bg-gray-100 text-gray-700',
};

function faviconUrl(domain: string) {
  try {
    const host = domain.replace(/^https?:\/\//, '').split('/')[0];
    return `https://www.google.com/s2/favicons?domain=${host}&sz=16`;
  } catch {
    return null;
  }
}

const TopDomainsSection = () => {
  const { selectedWeek, refreshKey, activeClientId } = useWeek();
  const { clientName } = useAdmin();
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!selectedWeek || !activeClientId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const fetchDomains = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_domains')
        .select('*')
        .eq('client_id', activeClientId)
        .eq('week_start', selectedWeek)
        .order('retrieved_percentage', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch ai_domains:', error);
        setRows([]);
      } else {
        setRows((data ?? []).map((r: any) => ({
          domain: r.domain ?? '',
          classification: r.classification ?? 'OTHER',
          retrieved_percentage: r.retrieved_percentage ?? 0,
          citation_rate: r.citation_rate ?? 0,
        })));
      }
      setLoading(false);
    };
    fetchDomains();
  }, [selectedWeek, activeClientId, refreshKey]);

  const types = ['All', ...Array.from(new Set(rows.map(r => r.classification).filter(Boolean))).sort()];
  const allFiltered = rows.filter(r => typeFilter === 'All' || r.classification === typeFilter);
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const filtered = allFiltered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">
        Top Domains Where {clientName ?? 'Brand'} Appears
      </h3>
      <p className="text-[10px] text-muted-foreground mb-4">Domain sources cited by AI platforms — sorted by retrieval frequency</p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No domain data for this week.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setPage(1); }}
                className={`px-3 py-1 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors border ${typeFilter === t ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-bold tracking-[0.1em] uppercase">Domain</TableHead>
                <TableHead className="text-[10px] font-bold tracking-[0.1em] uppercase">Type</TableHead>
                <TableHead className="text-[10px] font-bold tracking-[0.1em] uppercase text-right">Retrieved %</TableHead>
                <TableHead className="text-[10px] font-bold tracking-[0.1em] uppercase text-right">Citation Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, idx) => {
                const colorClass = TYPE_COLORS[r.classification.toUpperCase()] || TYPE_COLORS.OTHER;
                const favicon = faviconUrl(r.domain);
                return (
                  <TableRow key={idx}>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        {favicon && <img src={favicon} alt="" className="w-4 h-4" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                        <span className="text-sm font-medium">{r.domain}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 rounded-sm ${colorClass}`}>
                        {r.classification}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right text-sm">{r.retrieved_percentage}%</TableCell>
                    <TableCell className="py-2.5 text-right text-sm">{r.citation_rate}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default TopDomainsSection;
