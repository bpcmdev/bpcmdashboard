import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

const scorecards = [
  { platform: 'CHATGPT', subtitle: 'OpenAI · GPT-4o', score: 74, badge: 'STRONG', badgeStyle: 'bg-foreground text-background', delta: '▲ +6pts this month', deltaColor: 'text-positive' },
  { platform: 'PERPLEXITY', subtitle: 'Perplexity AI', score: 68, badge: 'STRONG', badgeStyle: 'bg-foreground text-background', delta: '▲ +9pts this month', deltaColor: 'text-positive' },
  { platform: 'RUFUS', subtitle: 'Amazon · Shopping AI', score: 61, badge: 'STRONG', badgeStyle: 'bg-foreground text-background', delta: '▲ +11pts this month', deltaColor: 'text-positive' },
  { platform: 'GEMINI', subtitle: 'Google · Gemini 1.5', score: 51, badge: 'MODERATE', badgeStyle: 'bg-corp-news', delta: '— flat this month', deltaColor: 'text-neutral-delta' },
  { platform: 'CLAUDE', subtitle: 'Anthropic', score: 43, badge: 'NEEDS WORK', badgeStyle: 'border border-destructive text-destructive bg-transparent', delta: '▼ -2pts this month', deltaColor: 'text-negative' },
];

const trendData = [
  { week: 'Jan 5', chatgpt: 57, perplexity: 55, rufus: 45, gemini: 48, claude: 48 },
  { week: 'Jan 12', chatgpt: 58, perplexity: 56, rufus: 46, gemini: 48, claude: 47 },
  { week: 'Jan 19', chatgpt: 60, perplexity: 57, rufus: 47, gemini: 49, claude: 47 },
  { week: 'Jan 26', chatgpt: 62, perplexity: 58, rufus: 48, gemini: 49, claude: 46 },
  { week: 'Feb 2', chatgpt: 63, perplexity: 59, rufus: 50, gemini: 50, claude: 46 },
  { week: 'Feb 9', chatgpt: 65, perplexity: 61, rufus: 52, gemini: 50, claude: 45 },
  { week: 'Feb 16', chatgpt: 67, perplexity: 63, rufus: 54, gemini: 51, claude: 45 },
  { week: 'Feb 23', chatgpt: 69, perplexity: 64, rufus: 56, gemini: 51, claude: 44 },
  { week: 'Mar 2', chatgpt: 70, perplexity: 65, rufus: 57, gemini: 51, claude: 44 },
  { week: 'Mar 9', chatgpt: 71, perplexity: 66, rufus: 59, gemini: 51, claude: 43 },
  { week: 'Mar 16', chatgpt: 73, perplexity: 67, rufus: 60, gemini: 51, claude: 43 },
  { week: 'Mar 23', chatgpt: 74, perplexity: 68, rufus: 61, gemini: 51, claude: 43 },
];

const aiSovData = [
  { brand: 'Rhode', pct: 24 },
  { brand: 'Glossier', pct: 21 },
  { brand: 'Milk Makeup', pct: 18, highlight: true },
  { brand: 'Pat McGrath Labs', pct: 14 },
  { brand: 'Merit Beauty', pct: 10 },
  { brand: 'Tower 28', pct: 8 },
  { brand: 'Charlotte Tilbury', pct: 5 },
];

const topQueries = [
  { rank: 1, query: 'Best Sephora makeup launches 2026', tag: 'PRODUCT LAUNCH', tagColor: 'text-positive', searches: '180K searches', platforms: '5/5 platforms' },
  { rank: 2, query: 'Best clean concealer 2026', tag: 'CLEAN BEAUTY', tagColor: 'text-positive', searches: '110K searches', platforms: '5/5 platforms' },
  { rank: 3, query: 'Top indie beauty brands right now', tag: 'CATEGORY', tagColor: 'text-muted-foreground', searches: '90K searches', platforms: '4/5 platforms' },
  { rank: 4, query: 'Vegan cruelty-free makeup recommendations', tag: 'VALUES / ETHICS', tagColor: 'text-muted-foreground', searches: '74K searches', platforms: '4/5 platforms' },
];

export const PlatformScorecards = () => (
  <div className="grid grid-cols-5 gap-4">
    {scorecards.map((s) => (
      <div key={s.platform} className="bg-card border border-border p-4">
        <p className="text-xs font-bold tracking-wider">{s.platform}</p>
        <p className="text-[10px] text-muted-foreground mb-2">{s.subtitle}</p>
        <p className="text-3xl font-bold text-foreground mb-1">{s.score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
        <span className={`inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-1 ${s.badgeStyle}`}>{s.badge}</span>
        <p className={`text-[11px] ${s.deltaColor}`}>{s.delta}</p>
      </div>
    ))}
  </div>
);

export const ViewToggle = ({ active, onToggle }: { active: string; onToggle: (v: string) => void }) => (
  <div className="flex gap-0 border border-border w-fit">
    {['BY PLATFORM', 'HEATMAP', 'GAP ANALYSIS', 'TOP QUERIES + SOV'].map((v) => (
      <button key={v} onClick={() => onToggle(v)} className={`px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${active === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
        {v}
      </button>
    ))}
  </div>
);

const AIVisibilityTab = () => {
  const [view, setView] = useState('BY PLATFORM');

  return (
    <div className="p-6 space-y-6">
      <PlatformScorecards />
      <ViewToggle active={view} onToggle={setView} />

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Visibility Score Trend — 12 Weeks</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(0 0% 45%)' }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
              <YAxis domain={[30, 85]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
              <Line type="monotone" dataKey="chatgpt" name="ChatGPT" stroke="hsl(0 0% 9%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="perplexity" name="Perplexity" stroke="hsl(0 0% 30%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rufus" name="Rufus" stroke="hsl(38 80% 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gemini" name="Gemini" stroke="hsl(0 0% 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="claude" name="Claude" stroke="hsl(0 0% 75%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[
              { name: 'ChatGPT', color: 'hsl(0 0% 9%)' },
              { name: 'Perplexity', color: 'hsl(0 0% 30%)' },
              { name: 'Rufus', color: 'hsl(38 80% 55%)' },
              { name: 'Gemini', color: 'hsl(0 0% 55%)' },
              { name: 'Claude', color: 'hsl(0 0% 75%)' },
            ].map((l) => (
              <div key={l.name} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-muted-foreground">{l.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">AI SOV vs Competitive Set</h3>
          <div className="space-y-2.5">
            {aiSovData.map((row, i) => (
              <div key={row.brand} className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-4 text-right">#{i + 1}</span>
                <span className={`text-xs w-32 truncate ${row.highlight ? 'font-bold text-foreground' : 'text-foreground/80'}`}>{row.brand}</span>
                <div className="flex-1 h-4 bg-secondary">
                  <div className={`h-full ${row.highlight ? 'bg-foreground' : 'bg-foreground/40'}`} style={{ width: `${(row.pct / 30) * 100}%` }} />
                </div>
                <span className={`text-xs w-8 text-right ${row.highlight ? 'font-bold' : ''}`}>{row.pct}%</span>
                {row.highlight && <span className="text-[10px] text-positive">▲ +7pts</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Queries */}
      <div className="bg-card border border-border p-5">
        <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">Top Queries Where Milk Appears</h3>
        <p className="text-[10px] text-muted-foreground mb-4">Expand each query for per-platform detail and competitive SOV — ranked dynamically</p>
        <div className="divide-y divide-border">
          {topQueries.map((q) => (
            <div key={q.rank} className="flex items-center gap-4 py-3">
              <span className="text-sm font-bold w-6 text-right text-muted-foreground">{q.rank}</span>
              <span className="text-sm font-medium flex-1">"{q.query}"</span>
              <span className={`text-[9px] font-bold tracking-[0.1em] uppercase ${q.tagColor}`}>{q.tag}</span>
              <span className="text-[11px] text-muted-foreground">{q.searches} · {q.platforms}</span>
              <span className="text-muted-foreground text-xs">▼</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIVisibilityTab;
