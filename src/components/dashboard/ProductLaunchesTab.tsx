import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const sovData = [
  { brand: 'Milk Makeup', pct: 28 },
  { brand: 'Rhode', pct: 22 },
  { brand: 'Charlotte Tilbury', pct: 18 },
  { brand: 'Glossier', pct: 14 },
];

const pressHighlights = [
  { outlet: 'Hypebeast', headline: 'The product everyone\'s talking about', date: 'Mar 18', reach: '5.7M reach', type: 'Organic', tier: 'TIER 1' },
  { outlet: 'Allure', headline: 'Best new clean beauty launches of March', date: 'Mar 17', reach: '3.4M reach', type: 'BPCM placed', tier: 'TIER 1' },
  { outlet: 'WWD', headline: 'Male ambassador strategy paying off for Milk', date: 'Mar 9', reach: '4.2M reach', type: 'BPCM placed', tier: 'TIER 2' },
];

const influencerActivations = [
  { initials: 'CS', name: 'Connor Storrie', campaign: 'Golden Globes preview · 2.1M', reach: '4.8M', eng: '6.2%', roi: '8.1x' },
  { initials: 'JB', name: 'Jess Brolin', campaign: 'TikTok seeding · 890K', reach: '2.3M', eng: '4.1%', roi: '5.4x' },
  { initials: 'MT', name: 'Maya Tran', campaign: 'Instagram seeding · 640K', reach: '1.6M', eng: '5.8%', roi: '6.3x' },
];

const fallProducts = [
  {
    title: 'NEW STICKS — FULL RELAUNCH',
    body: 'Reformulated formula + new packaging — entire sticks franchise. After 10 years, iconic sticks get new formula (+2G fill), elevated packaging, skincare hybrid ingredients. Hero: Lip + Cheek (8 shades) and Lip + Cheek Matte (8 shades). Resolves propel/repel issues.',
    badges: [{ label: 'HERO LAUNCH', style: 'bg-foreground text-background' }, { label: 'NEW FORMULA', style: 'bg-corp-news' }],
  },
  {
    title: 'LINE + FILL LIP COLOR',
    body: 'Dual-purpose liner + lipstick · 10 shades · $24–26. 10H+ longwear, hydrating matte finish. Retractable with built-in sharpener. Raspberry seed oil, avocado oil, aloe vera, ceramides. Entry price point.',
    badges: [{ label: 'NEW LAUNCH', style: 'bg-foreground text-background' }, { label: 'ENTRY PRODUCT', style: 'bg-muted-foreground/80 text-background' }],
  },
  {
    title: 'GLOW HIGHLIGHTER',
    body: 'Cream highlighter stick · 5 shades. Lit · Turnt · Mars (Golden Peach Holographic) · Rad (Pink Pearl) · Glitzed (Pinky Bronze)',
    badges: [{ label: 'REFORMULATED', style: 'bg-muted-foreground/80 text-background' }],
  },
];

const tierClass: Record<string, string> = { 'TIER 1': 'bg-tier1', 'TIER 2': 'bg-tier2' };

const ProductLaunchesTab = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Active Launch Banner */}
      <div className="bg-foreground text-background p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-wide">HYDRO GRIP GEL CONCEALER</h3>
            <p className="text-xs opacity-70 mt-1">Sephora + Ulta Beauty · Full PR + TikTok Shop program active · Launched Feb 4, 2026 · 25 shades</p>
          </div>
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border border-background/30">ACTIVE</span>
        </div>
        <div className="mt-3 h-1 bg-background/20 w-full">
          <div className="h-full bg-background/60" style={{ width: '60%' }} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'TOTAL PLACEMENTS', value: '31', sub: 'since launch' },
          { label: 'EMV GENERATED', value: '$1.2M', sub: '▲ vs $800K target', positive: true },
          { label: 'INFLUENCER REACH', value: '9.4M', sub: 'all activations' },
          { label: 'TIKTOK SHOP GMV', value: '$94K', sub: '▲ 22% WoW · 3.4x ROAS', positive: true },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border p-4 text-center">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className={`text-[11px] mt-0.5 ${kpi.positive ? 'text-positive' : 'text-muted-foreground'}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Press + Influencer side by side */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Press Highlights</h3>
          <div className="divide-y divide-border">
            {pressHighlights.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-3 min-w-0">
                <span className="text-sm font-bold w-20 shrink-0">{p.outlet}</span>
                <span className="text-xs flex-1 min-w-0 truncate text-foreground/80">{p.headline}</span>
                <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">{p.date} · {p.reach} · {p.type}</span>
                <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 shrink-0 whitespace-nowrap ${tierClass[p.tier] ?? 'bg-tier1'}`}>{p.tier}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Influencer Activations</h3>
          <div className="divide-y divide-border">
            {influencerActivations.map((inf, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{inf.initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{inf.name}</p>
                  <p className="text-[11px] text-muted-foreground">{inf.campaign}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold">{inf.reach} / {inf.eng}</p>
                  <p className="text-[11px] text-muted-foreground">{inf.roi}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product SOV bar chart */}
      <div className="bg-card border border-border p-5">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sovData} layout="vertical" margin={{ left: 120, right: 40 }}>
            <XAxis type="number" domain={[0, 35]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: 'hsl(0 0% 20%)' }} axisLine={false} tickLine={false} width={110} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
            <Bar dataKey="pct" fill="hsl(0 0% 9%)" radius={[0, 1, 1, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fall 2026 Pipeline */}
      <div className="bg-foreground text-background p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider">FALL 2026</span>
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 bg-corp-news">LIPS + STICKS</span>
        </div>
        <span className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 border border-background/30">UPCOMING</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {fallProducts.map((prod, i) => (
          <div key={i} className="bg-card border border-border p-5">
            <h4 className="text-sm font-bold text-foreground mb-2">{prod.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{prod.body}</p>
            <div className="flex gap-2 flex-wrap">
              {prod.badges.map((b, j) => (
                <span key={j} className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 ${b.style}`}>{b.label}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductLaunchesTab;
