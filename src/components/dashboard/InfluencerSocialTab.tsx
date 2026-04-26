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
        <div className="col-span-3 bg-card border border-black/10 p-5">
          <h3 className="section-label mb-4">Platform Performance — This Week</h3>
          <div className="space-y-3 mb-6">
            {platformData.map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <span className="text-xs font-medium w-20 text-foreground">{p.platform}</span>
                <div className="flex-1 h-5 bg-secondary">
                  <div className="h-full" style={{ width: `${p.pct}%`, background: 'hsl(225 70% 35%)' }} />
                </div>
                <span className="text-xs text-muted-foreground w-24 text-right">{p.reach}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={engagementTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
              <YAxis domain={[3, 5.5]} tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', color: 'hsl(0 0% 8%)', fontSize: 11 }} />
              <Area type="monotone" dataKey="rate" stroke="hsl(225 70% 35%)" fill="hsl(225 70% 35% / 0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Influencer ROI */}
        <div className="col-span-2 bg-card border border-black/10 p-5">
          <h3 className="section-label mb-4">Influencer ROI by Tier</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={roiData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="tier" tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', color: 'hsl(0 0% 8%)', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="reach" name="Reach" fill="hsl(225 70% 35%)" barSize={14} />
              <Bar dataKey="engagement" name="Engagement" fill="hsl(42 64% 45%)" barSize={14} />
              <Bar dataKey="roi" name="ROI" fill="hsl(0 0% 70%)" barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Influencer Activations */}
      <div className="bg-card border border-black/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">Active Influencer Activations</span>
          <span className="section-count">{influencers.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {influencers.map((inf, i) => {
            const engMatch = inf.stats.match(/([\d.]+)%\s*eng/);
            const engPct = engMatch ? parseFloat(engMatch[1]) : 0;
            const roiMatch = inf.stats.match(/([\d.]+)x\s*ROI/);
            const roi = roiMatch ? roiMatch[1] : '—';
            const isHighEng = engPct > 5;
            return (
              <div key={i} className="entry-card cat-influencer bg-card border border-black/10 p-4 cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, hsl(225 70% 35%) 0%, #7C3AED 100%)' }}
                  >
                    {inf.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{inf.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{inf.handle}</p>
                  </div>
                  <span className={`font-mono-ui text-[9px] font-medium tracking-[0.12em] uppercase px-2 py-0.5 text-white shrink-0 ${inf.platformColor}`}>{inf.platform}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-black/10">
                  <div>
                    <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground mb-0.5">Reach</p>
                    <p className="font-display text-sm font-bold text-foreground">{inf.reach.split(' ')[0]}</p>
                  </div>
                  <div>
                    <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground mb-0.5">Engagement</p>
                    <span
                      className={`inline-block font-display text-sm font-bold px-1.5 py-0.5 rounded-sm ${isHighEng ? 'border' : ''}`}
                      style={isHighEng ? { background: 'rgba(124,58,237,0.1)', color: '#7C3AED', borderColor: 'rgba(124,58,237,0.3)' } : { color: 'hsl(0 0% 8%)' }}
                    >
                      {engPct}%
                    </span>
                  </div>
                  <div>
                    <p className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground mb-0.5">ROI</p>
                    <p className="font-display text-sm font-bold" style={{ color: 'hsl(42 64% 38%)' }}>{roi}x</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InfluencerSocialTab;
