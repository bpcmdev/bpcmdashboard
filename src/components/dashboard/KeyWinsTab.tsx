const WINS = [
  {
    column: 'Corporate Comms',
    cards: [
      {
        tag: 'CORPORATE COMMS',
        headline: 'Frank B appointment — 14 earned pieces in 5 days',
        body: 'BPCM drafted and distributed the Global Artistic Director announcement, securing placements in WWD, Vogue, Allure + 11 more. Positive sentiment at 71%.',
        footer: '$680K EMV · Tier 1 dominant · Key message uptake 88%',
      },
      {
        tag: 'BRAND PARTNERSHIP',
        headline: 'Boots UK launch — accelerating international',
        body: 'New UK retail partnership supporting Waldencast\'s international turnaround. BPCM coordinating UK trade and consumer press.',
        footer: 'UK market entry · Trade + consumer PR active',
      },
    ],
  },
  {
    column: 'Earned Media',
    cards: [
      {
        tag: 'EARNED MEDIA',
        headline: 'Hypebeast Hydro Grip Gel Concealer feature',
        body: 'Unsolicited deep-dive following Connor Storrie\'s Golden Globes preview. Highest-reach organic piece of the quarter — no paid support.',
        footer: '5.7M reach · Tier 1 · Organic',
      },
      {
        tag: 'EARNED MEDIA',
        headline: 'Vogue "brands rewriting their stories" feature',
        body: 'BPCM placed Milk Makeup in a marquee Vogue digital feature supporting the turnaround narrative at the highest editorial tier.',
        footer: '8.1M reach · Tier 1 · BPCM placed',
      },
    ],
  },
  {
    column: 'Influencer & Social',
    cards: [
      {
        tag: 'INFLUENCER & SOCIAL',
        headline: 'Connor Storrie activation — 8.1x ROI',
        body: '4.8M reach across Instagram with 6.2% engagement — well above the 2.8% category benchmark.',
        footer: '4.8M reach · 6.2% eng · 8.1x ROI',
      },
      {
        tag: 'INFLUENCER & SOCIAL',
        headline: 'Engagement rate up 64% over 8 weeks',
        body: 'Average influencer engagement climbed from 3.1% to 5.1% — driven by tighter selection and the Frank B cultural moment.',
        footer: '3.1% → 5.1% · 8-week trend · All platforms',
      },
    ],
  },
];

const KeyWinsTab = () => {
  return (
    <div className="p-6">
      <div className="grid grid-cols-3 gap-6">
        {WINS.map((col) => (
          <div key={col.column} className="space-y-4">
            {col.cards.map((card, i) => (
              <div key={i} className="bg-card border border-border p-5">
                <span className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 bg-foreground text-background mb-3">
                  {card.tag}
                </span>
                <h4 className="text-sm font-bold text-foreground mb-2">{card.headline}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{card.body}</p>
                <div className="border-t border-border pt-3">
                  <p className="text-[11px] text-muted-foreground">{card.footer}</p>
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
