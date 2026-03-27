import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine, Cell } from 'recharts';

const gmvData = [
  { week: 'Jan 5', gmv: 18, campaign: 'evergreen' },
  { week: 'Jan 12', gmv: 22, campaign: 'evergreen' },
  { week: 'Jan 19', gmv: 24, campaign: 'evergreen' },
  { week: 'Jan 26', gmv: 38, campaign: 'jelly' },
  { week: 'Feb 2', gmv: 112, campaign: 'jelly' },
  { week: 'Feb 9', gmv: 58, campaign: 'jelly' },
  { week: 'Feb 16', gmv: 62, campaign: 'concealer' },
  { week: 'Feb 23', gmv: 72, campaign: 'concealer' },
  { week: 'Mar 2', gmv: 78, campaign: 'concealer' },
  { week: 'Mar 9', gmv: 88, campaign: 'concealer' },
  { week: 'Mar 16', gmv: 95, campaign: 'concealer' },
  { week: 'Mar 23', gmv: 100, campaign: 'frankb' },
];

const campaignColors: Record<string, string> = {
  evergreen: 'hsl(0 0% 80%)',
  jelly: 'hsl(145 63% 42%)',
  concealer: 'hsl(0 0% 9%)',
  frankb: 'hsl(38 50% 55%)',
};

const trendingProducts = [
  {
    tag: 'ACTIVE CAMPAIGN', tagStyle: 'bg-foreground text-background',
    title: 'HYDRO GRIP GEL CONCEALER', detail: 'Shop Ads + Spark Ads · Feb 4',
    gmv: '$94K', delta: '▲ 22% WoW · 3.4x ROAS', deltaColor: 'text-positive',
    progress: 70, progressColor: 'bg-foreground',
    footerBadge: 'ACTIVE CAMPAIGN', footerStyle: 'bg-foreground text-background',
    ranking: 'TRENDING #1',
  },
  {
    tag: 'EVERGREEN HERO', tagStyle: 'bg-[hsl(145_63%_42%)] text-background',
    title: 'COOLING WATER JELLY TINT', detail: 'Affiliate-driven · 60K+ waitlist at launch',
    gmv: '$71K', delta: '▲ 8% WoW · 4.1x ROAS', deltaColor: 'text-positive',
    progress: 60, progressColor: 'bg-[hsl(145_63%_42%)]',
    footerBadge: 'EVERGREEN', footerStyle: 'bg-[hsl(145_63%_42%)] text-background',
  },
  {
    tag: 'ORGANIC LIFT', tagStyle: 'bg-corp-news',
    title: 'KUSH MASCARA', detail: 'No active campaign · Frank B halo',
    gmv: '$14K', delta: '▲ 31% WoW · No paid support', deltaColor: 'text-positive',
    progress: 20, progressColor: 'bg-corp-news',
    footerBadge: 'ORGANIC LIFT', footerStyle: 'bg-corp-news',
  },
  {
    tag: 'ACTIVE', tagStyle: 'bg-foreground text-background',
    title: 'HYDRO GRIP PRIMER', detail: 'Spark Ads + organic',
    gmv: '$31K', delta: '— flat WoW · 2.9x ROAS', deltaColor: 'text-neutral-delta',
    progress: 35, progressColor: 'bg-foreground',
    footerBadge: 'ACTIVE', footerStyle: 'bg-foreground text-background',
  },
  {
    tag: 'HALO PRODUCT', tagStyle: 'bg-muted text-muted-foreground',
    title: 'JELLY BLUSH', detail: 'Riding Jelly Tint halo',
    gmv: '$8K', delta: '▲ 14% WoW · 2.1x ROAS', deltaColor: 'text-positive',
    progress: 10, progressColor: 'bg-muted-foreground',
    footerBadge: 'HALO', footerStyle: 'bg-muted text-muted-foreground',
  },
  {
    tag: 'UPCOMING · FALL 2026', tagStyle: 'bg-muted text-muted-foreground',
    title: 'NEW STICKS + LINE + FILL', detail: 'TikTok Shop strategy in development',
    gmv: '', delta: '', deltaColor: '',
    body: 'Major Fall 2026 launch expected to drive significant TikTok Shop momentum.',
    progress: 0, progressColor: '',
    footerBadge: 'IN PLANNING', footerStyle: 'border border-border text-muted-foreground bg-transparent',
  },
];

const TikTokShopTab = () => {
  return (
    <div className="p-6 space-y-6">
      {/* KPI Bar */}
      <div className="bg-card flex divide-x divide-border border border-border">
        {[
          { label: 'TOTAL GMV — MTD', value: '$218K', sub: '▲ 83% vs last month', positive: true },
          { label: 'ROAS — SHOP ADS', value: '3.4x', sub: '▲ vs 2.88x baseline', positive: true },
          { label: 'VIDEO VIEWS', value: '4.1M', sub: '▲ 11% WoW', positive: true },
          { label: 'SHOP CONVERSION', value: '6.8%', sub: '▲ vs 4.2% avg', positive: true },
        ].map((kpi) => (
          <div key={kpi.label} className="flex-1 px-5 py-4 text-center">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className={`text-[11px] mt-0.5 ${kpi.positive ? 'text-positive' : 'text-muted-foreground'}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Campaign window legend */}
      <div className="flex gap-4 items-center">
        {[
          { color: 'bg-[hsl(145_63%_42%)]', label: 'Jelly Tint launch · Jan 26–Feb 9' },
          { color: 'bg-foreground', label: 'Hydro Grip Concealer · Feb 4–ongoing' },
          { color: 'bg-corp-news', label: 'Frank B · Mar 20+' },
          { color: 'bg-muted-foreground/50', label: 'Evergreen / organic' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 ${l.color}`} />
            <span className="text-[10px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* GMV Chart */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">GMV by Week — Campaign Windows Annotated</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={gmvData} margin={{ top: 20, right: 40, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}K`} domain={[0, 120]} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} formatter={(v: number) => `$${v}K`} />
            <ReferenceLine x="Feb 16" stroke="hsl(0 0% 45%)" strokeDasharray="4 4" label={{ value: 'Concealer launch', position: 'top', fontSize: 9, fill: 'hsl(0 0% 45%)' }} />
            <Bar dataKey="gmv" radius={[1, 1, 0, 0]} barSize={22}>
              {gmvData.map((entry, index) => (
                <Cell key={index} fill={campaignColors[entry.campaign]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Trending Products */}
      <div>
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Trending Products This Week</h3>
        <div className="grid grid-cols-3 gap-4">
          {trendingProducts.map((prod, i) => (
            <div key={i} className="bg-card border border-border p-5 relative">
              {prod.ranking && (
                <span className="absolute top-3 right-3 text-[9px] font-bold tracking-[0.1em] uppercase bg-foreground text-background px-1.5 py-0.5">{prod.ranking}</span>
              )}
              <span className={`inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-3 ${prod.tagStyle}`}>{prod.tag}</span>
              <h4 className="text-sm font-bold mb-1">{prod.title}</h4>
              <p className="text-[11px] text-muted-foreground mb-3">{prod.detail}</p>
              {'body' in prod && prod.body && <p className="text-xs text-muted-foreground mb-3">{prod.body}</p>}
              {prod.gmv && (
                <>
                  <p className="text-xl font-bold mb-0.5">{prod.gmv}</p>
                  <p className={`text-[11px] mb-3 ${prod.deltaColor}`}>{prod.delta}</p>
                  <div className="h-1.5 bg-secondary w-full mb-3">
                    <div className={`h-full ${prod.progressColor}`} style={{ width: `${prod.progress}%` }} />
                  </div>
                </>
              )}
              <span className={`inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 ${prod.footerStyle}`}>{prod.footerBadge}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TikTokShopTab;
