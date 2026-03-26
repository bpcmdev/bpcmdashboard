interface Placement {
  outlet: string;
  headline: string;
  date: string;
  reach: string;
  placedBy: string;
  tier: 'TIER 1' | 'TIER 2' | 'TIER 3' | 'CORP NEWS';
}

const placements: Placement[] = [
  {
    outlet: 'WWD',
    headline: 'Milk Makeup names Frank B as Global Artistic Director',
    date: 'Mar 21',
    reach: '4.2M reach',
    placedBy: 'BPCM placed',
    tier: 'TIER 1',
  },
  {
    outlet: 'Vogue',
    headline: 'The beauty brands rewriting their stories in 2026',
    date: 'Mar 20',
    reach: '8.1M reach',
    placedBy: 'BPCM placed',
    tier: 'TIER 1',
  },
  {
    outlet: 'Cosmetics Business',
    headline: 'Waldencast plots Milk Makeup turnaround: Rassi takes the helm',
    date: 'Mar 19',
    reach: '1.8M reach',
    placedBy: 'Organic',
    tier: 'CORP NEWS',
  },
  {
    outlet: 'Hypebeast',
    headline: 'Hydro Grip Gel Concealer is the product everyone\'s talking about',
    date: 'Mar 18',
    reach: '5.7M reach',
    placedBy: 'Organic',
    tier: 'TIER 1',
  },
];

const tierClass: Record<string, string> = {
  'TIER 1': 'bg-tier1',
  'TIER 2': 'bg-tier2',
  'TIER 3': 'bg-tier3',
  'CORP NEWS': 'bg-corp-news',
};

const TopPlacements = () => {
  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">
        Top Placements This Week
      </h3>
      <div className="divide-y divide-border">
        {placements.map((p, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <span className="text-sm font-bold w-36 shrink-0">{p.outlet}</span>
            <span className="text-sm flex-1 text-foreground/80">{p.headline}</span>
            <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
              <span>{p.date}</span>
              <span>·</span>
              <span>{p.reach}</span>
              <span>·</span>
              <span>{p.placedBy}</span>
            </div>
            <span className={`shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 ${tierClass[p.tier]}`}>
              {p.tier}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopPlacements;
