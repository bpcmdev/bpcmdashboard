import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SovRow {
  rank: number;
  brand: string;
  pct: number;
  delta: string;
  highlight: boolean;
}

const fallbackData: SovRow[] = [
  { rank: 1, brand: 'Milk Makeup', pct: 21, delta: '▲+4pts', highlight: true },
  { rank: 2, brand: 'Rhode', pct: 20, delta: '-1pt', highlight: false },
  { rank: 3, brand: 'Pat McGrath Labs', pct: 17, delta: '—', highlight: false },
  { rank: 4, brand: 'Glossier', pct: 16, delta: '—', highlight: false },
  { rank: 5, brand: 'Merit Beauty', pct: 13, delta: '—', highlight: false },
  { rank: 6, brand: 'Tower 28', pct: 10, delta: '-2pts', highlight: false },
  { rank: 7, brand: 'Charlotte Tilbury', pct: 5, delta: '—', highlight: false },
];

function formatDeltaPts(pts: number): string {
  if (pts > 0) return `▲+${pts}pts`;
  if (pts < 0) return `${pts}pt${Math.abs(pts) !== 1 ? 's' : ''}`;
  return '—';
}

const ShareOfVoiceTable = () => {
  const [sovData, setSovData] = useState<SovRow[]>(fallbackData);

  useEffect(() => {
    const fetchSov = async () => {
      const { data, error } = await supabase
        .from('competitive_sov')
        .select('*')
        .order('rank', { ascending: true });

      if (error || !data || data.length === 0) {
        console.error('Failed to fetch competitive_sov:', error);
        return;
      }

      setSovData(data.map((row: Record<string, any>) => ({
        rank: row.rank ?? 0,
        brand: row.brand_name ?? '',
        pct: row.sov_pct ?? 0,
        delta: formatDeltaPts(row.delta_pts ?? 0),
        highlight: (row.brand_name ?? '').toLowerCase().includes('milk'),
      })));
    };

    fetchSov();
  }, []);

  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Share of Voice — Competitive Set
      </h3>
      <div className="space-y-2.5">
        {sovData.map((row) => (
          <div key={row.rank} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-4 text-right">#{row.rank}</span>
            <span className={`text-xs w-32 truncate ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/80'}`}>
              {row.brand}
            </span>
            <div className="flex-1 h-4 bg-secondary relative">
              <div
                className={`h-full ${row.highlight ? 'bg-foreground' : 'bg-foreground/40'}`}
                style={{ width: `${(row.pct / 25) * 100}%` }}
              />
            </div>
            <span className={`text-xs w-8 text-right ${row.highlight ? 'font-bold' : ''}`}>{row.pct}%</span>
            <span className={`text-[10px] w-14 text-right ${
              row.delta.includes('▲') ? 'text-positive' : row.delta.includes('-') ? 'text-negative' : 'text-neutral-delta'
            }`}>
              {row.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShareOfVoiceTable;
