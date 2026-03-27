import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, Legend } from 'recharts';

const platformData = [
  { platform: 'Instagram', reach: '3.8M reach', pct: 100 },
  { platform: 'TikTok', reach: '2.1M views', pct: 55 },
  { platform: 'LinkedIn', reach: '490K reach', pct: 13 },
];

const engagementTrend = [
  { week: 'Jan 26', rate: 3.2 },
  { week: 'Feb 2', rate: 3.0 },
  { week: 'Feb 9', rate: 3.4 },
  { week: 'Feb 16', rate: 3.6 },
  { week: 'Feb 23', rate: 3.9 },
  { week: 'Mar 2', rate: 4.2 },
  { week: 'Mar 9', rate: 4.5 },
  { week: 'Mar 16', rate: 4.8 },
  { week: 'Mar 23', rate: 5.1 },
];

const roiData = [
  { tier: 'Mega', reach: 4.5, engagement: 5, roi: 8 },
  { tier: 'Macro', reach: 3, engagement: 4, roi: 5 },
  { tier: 'Micro', reach: 5, engagement: 1.5, roi: 3.5 },
];

const influencers = [
  { initials: 'CS', name: 'Connor Storrie', handle: '@connorstor · 2.1M followers', platform: 'INSTAGRAM', platformColor: 'bg-[hsl(210_80%_55%)]', reach: '4.8M reach', stats: '6.2% eng · 8.1x ROI' },
  { initials: 'JB', name: 'Jess Brolin', handle: '@jessbrolin · 890K followers', platform: 'TIKTOK', platformColor: 'bg-foreground', reach: '2.3M views', stats: '4.1% eng · 5.4x ROI' },
  { initials: 'MT', name: 'Maya Tran', handle: '@mayatran · 640K followers', platform: 'INSTAGRAM', platformColor: 'bg-[hsl(210_80%_55%)]', reach: '1.6M reach', stats: '5.8% eng · 6.3x ROI' },
  { initials: 'AK', name: 'Alex Kim', handle: '@alexkimbeauty · 78K followers', platform: 'TIKTOK', platformColor: 'bg-foreground', reach: '412K views', stats: '7.9% eng · 4.8x ROI' },
  { initials: 'RL', name: 'Remi Lavigne', handle: '@remilavigne · 31K followers', platform: 'INSTAGRAM', platformColor: 'bg-[hsl(210_80%_55%)]', reach: '88K reach', stats: '9.2% eng · 3.9x ROI' },
];

const InfluencerSocialTab = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Top row */}
      <div className="grid grid-cols-5 gap-6">
        {/* Platform Performance */}
        <div className="col-span-3 bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Platform Performance — This Week</h3>
          <div className="space-y-3 mb-6">
            {platformData.map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <span className="text-xs font-medium w-20">{p.platform}</span>
                <div className="flex-1 h-5 bg-secondary">
                  <div className="h-full bg-foreground" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-24 text-right">{p.reach}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={engagementTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
              <YAxis domain={[3, 5.5]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
              <Area type="monotone" dataKey="rate" stroke="hsl(0 0% 9%)" fill="hsl(0 0% 90%)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Influencer ROI */}
        <div className="col-span-2 bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Influencer ROI by Tier</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={roiData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
              <XAxis dataKey="tier" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="reach" name="Reach" fill="hsl(0 0% 9%)" barSize={14} />
              <Bar dataKey="engagement" name="Engagement" fill="hsl(0 0% 35%)" barSize={14} />
              <Bar dataKey="roi" name="ROI" fill="hsl(0 0% 70%)" barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Influencer Activations */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Active Influencer Activations</h3>
        <div className="divide-y divide-border">
          {influencers.map((inf, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{inf.initials}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{inf.name}</p>
                <p className="text-[11px] text-muted-foreground">{inf.handle}</p>
              </div>
              <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 text-background shrink-0 ${inf.platformColor}`}>{inf.platform}</span>
              <span className="text-xs text-foreground shrink-0 w-24 text-right">{inf.reach}</span>
              <span className="text-xs text-muted-foreground shrink-0 w-36 text-right">{inf.stats}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InfluencerSocialTab;
