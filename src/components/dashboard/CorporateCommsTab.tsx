import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const commsData = [
  { week: 'Jan 26', press: 1, trade: 0 },
  { week: 'Feb 2', press: 2, trade: 1 },
  { week: 'Feb 9', press: 1, trade: 1 },
  { week: 'Feb 16', press: 2, trade: 1 },
  { week: 'Feb 23', press: 2, trade: 1 },
  { week: 'Mar 2', press: 2, trade: 2 },
  { week: 'Mar 9', press: 3, trade: 1 },
  { week: 'Mar 16', press: 3, trade: 2 },
  { week: 'Mar 23', press: 4, trade: 3 },
];

const commsLog = [
  { title: 'Frank B named Global Artistic Director', detail: '14 earned pieces · WWD, Vogue, Allure, Beauty Independent + 10 more · BPCM drafted + distributed', date: 'Mar 20, 2026', badge: 'TIER 1', badgeStyle: 'bg-tier1' },
  { title: 'Waldencast Q4 2025 earnings + 2026 outlook', detail: 'Turnaround roadmap amplified · BPCM coordinated trade briefings', date: 'Mar 12, 2026 · 8 earned pieces', badge: 'CORP', badgeStyle: 'bg-corp-news' },
  { title: 'Hydro Grip Gel Concealer launch', detail: 'Product PR + Connor Storrie Golden Globes preview · 31 earned pieces · BPCM led', date: 'Feb 4, 2026', badge: 'TIER 1', badgeStyle: 'bg-tier1' },
  { title: 'Mazdack Rassi named President', detail: 'Founder return narrative · Cosmetics Business, Beauty Independent, WWD · 9 earned pieces · BPCM placed', date: 'Feb 2026', badge: 'CORP', badgeStyle: 'bg-corp-news' },
];

const CorporateCommsTab = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Active Story Banner */}
      <div
        className="p-4 flex items-center gap-4 border"
        style={{ background: 'hsl(225 70% 96%)', borderColor: 'hsl(225 70% 85%)' }}
      >
        <span
          className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 shrink-0"
          style={{ background: 'hsl(225 70% 35%)', color: '#fff' }}
        >
          ACTIVE STORY
        </span>
        <p className="text-xs text-foreground/80">Frank B / Global Artistic Director announcement generating strong positive pickup. 14 earned pieces in 5 days. Turnaround narrative gaining momentum.</p>
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-card border border-black/10 p-5">
          <h3 className="section-label mb-4">Comms Activity — 8 Weeks</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={commsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
              <YAxis domain={[0, 7]} tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', color: 'hsl(0 0% 8%)', fontSize: 11 }} />
              <Bar dataKey="press" stackId="a" fill="hsl(225 70% 35%)" barSize={20} />
              <Bar dataKey="trade" stackId="a" fill="hsl(42 64% 45%)" radius={[1, 1, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-2 bg-card border border-black/10 p-5">
          <h3 className="section-label mb-4">Sentiment on Corporate Narrative</h3>
          <div className="space-y-3">
            {[
              { label: 'Positive on leadership', pct: 71, color: 'hsl(225 70% 35%)' },
              { label: 'Neutral / informational', pct: 22, color: 'hsl(0 0% 60%)' },
              { label: 'Negative on financials', pct: 7, color: 'hsl(0 70% 50%)' },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{row.label}</span>
                  <span className="text-xs font-bold text-foreground">{row.pct}%</span>
                </div>
                <div className="h-5 bg-secondary w-full">
                  <div className="h-full" style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">Key message uptake: <span className="font-semibold text-foreground">'bold artistry + cultural relevance'</span> in 68% of coverage</p>
        </div>
      </div>

      {/* Communications Log */}
      <div className="bg-card border border-black/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="section-label">Corporate Communications Log</span>
          <span className="section-count">{commsLog.length}</span>
        </div>
        <div className="space-y-3">
          {commsLog.map((row, i) => (
            <div key={i} className="entry-card cat-corporate bg-card border border-black/10 flex items-center gap-4 p-4 cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{row.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{row.detail}</p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">{row.date}</span>
              <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 shrink-0 ${row.badgeStyle}`}>{row.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CorporateCommsTab;
