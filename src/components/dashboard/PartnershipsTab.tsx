import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const partnerships = [
  { title: 'BOOTS UK', subtitle: 'Retail expansion · UK market entry', body: 'BPCM coordinating UK trade + consumer press to support market entry.', badge: 'LIVE', badgeColor: 'bg-[hsl(145_63%_42%)] text-background' },
  { title: 'ULTA BEAUTY', subtitle: 'Retail · 600+ new US doors', body: 'Door-opening coverage + in-store activation PR ongoing.', badge: 'LIVE', badgeColor: 'bg-[hsl(145_63%_42%)] text-background' },
  { title: 'FRANK B CREATIVE PARTNERSHIP', subtitle: 'Creative · Campaign + editorial · Q2 2026', body: 'BPCM preparing launch PR strategy for first campaign under new creative direction.', badge: 'IN DEVELOPMENT', badgeColor: 'bg-corp-news' },
];

const emvData = [
  { program: 'Ulta Beauty', emv: 820 },
  { program: 'Boots UK', emv: 320 },
  { program: 'Frank B campaign', emv: 40 },
];

const history = [
  { title: 'Wu-Tang x Milk Makeup', detail: 'Limited edition lipstick collab · Cultural moment · BPCM-led', sub: 'Completed · $3.2M EMV generated', badge: 'PAST' },
  { title: 'Amazon Premium Beauty', detail: 'Channel launch · H1 2025', sub: 'Completed · $1.4M EMV generated', badge: 'PAST' },
];

const PartnershipsTab = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Active & Pipeline */}
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Active & Pipeline Partnerships</h3>
          <div className="space-y-4">
            {partnerships.map((p, i) => (
              <div key={i} className="border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-bold">{p.title}</h4>
                    <p className="text-[11px] text-muted-foreground">{p.subtitle}</p>
                  </div>
                  <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 shrink-0 ${p.badgeColor}`}>{p.badge}</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* EMV Chart */}
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Partnership EMV — Active Programs</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={emvData} layout="vertical" margin={{ left: 100, right: 30 }}>
              <XAxis type="number" domain={[0, 900]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}K`} />
              <YAxis type="category" dataKey="program" tick={{ fontSize: 11, fill: 'hsl(0 0% 20%)' }} axisLine={false} tickLine={false} width={95} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} formatter={(v: number) => `$${v}K`} />
              <Bar dataKey="emv" fill="hsl(0 0% 9%)" barSize={18} radius={[0, 1, 1, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Reference */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Historical Reference</h3>
        <div className="divide-y divide-border">
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{h.title}</p>
                <p className="text-[11px] text-muted-foreground">{h.detail}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{h.sub}</p>
              </div>
              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-muted text-muted-foreground shrink-0">{h.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PartnershipsTab;
