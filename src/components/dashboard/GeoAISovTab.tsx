import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ViewToggle } from './AIVisibilityTab';

const hardcodedScorecards = [
  { platform: 'CHATGPT', subtitle: 'OpenAI · GPT-4o', score: 74, badge: 'STRONG', badgeStyle: 'bg-foreground text-background', delta: '▲ +6pts this month', deltaColor: 'text-positive' },
  { platform: 'PERPLEXITY', subtitle: 'Perplexity AI', score: 68, badge: 'STRONG', badgeStyle: 'bg-foreground text-background', delta: '▲ +9pts this month', deltaColor: 'text-positive' },
  { platform: 'RUFUS', subtitle: 'Amazon · Shopping AI', score: 61, badge: 'STRONG', badgeStyle: 'bg-foreground text-background', delta: '▲ +11pts this month', deltaColor: 'text-positive' },
  { platform: 'GEMINI', subtitle: 'Google · Gemini 1.5', score: 51, badge: 'MODERATE', badgeStyle: 'bg-corp-news', delta: '— flat this month', deltaColor: 'text-neutral-delta' },
  { platform: 'CLAUDE', subtitle: 'Anthropic', score: 43, badge: 'NEEDS WORK', badgeStyle: 'border border-destructive text-destructive bg-transparent', delta: '▼ -2pts this month', deltaColor: 'text-negative' },
];

const GeoScorecards = () => (
  <div className="grid grid-cols-5 gap-4">
    {hardcodedScorecards.map((s) => (
      <div key={s.platform} className="bg-card border border-border p-4">
        <p className="text-xs font-bold tracking-wider">{s.platform}</p>
        <p className="text-[10px] text-muted-foreground mb-2 truncate">{s.subtitle}</p>
        <p className="text-3xl font-bold text-foreground mb-1">{s.score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
        <span className={`inline-block text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 mb-1 ${s.badgeStyle}`}>{s.badge}</span>
        <p className={`text-[11px] ${s.deltaColor}`}>{s.delta}</p>
      </div>
    ))}
  </div>
);

const platformCharts = [
  {
    title: 'CHATGPT — VISIBILITY SCORES',
    badge: null,
    data: [
      { brand: 'Milk Makeup', score: 82 },
      { brand: 'Rhode', score: 78 },
      { brand: 'Pat McGrath', score: 70 },
      { brand: 'Glossier', score: 65 },
      { brand: 'Merit Beauty', score: 52 },
      { brand: 'Tower 28', score: 45 },
      { brand: 'Charlotte Tilbury', score: 42 },
    ],
  },
  {
    title: 'PERPLEXITY — VISIBILITY SCORES',
    badge: null,
    data: [
      { brand: 'Rhode', score: 82 },
      { brand: 'Milk Makeup', score: 75 },
      { brand: 'Glossier', score: 68 },
      { brand: 'Pat McGrath', score: 62 },
      { brand: 'Merit Beauty', score: 58 },
      { brand: 'Tower 28', score: 48 },
      { brand: 'Charlotte Tilbury', score: 38 },
    ],
  },
  {
    title: 'RUFUS — VISIBILITY SCORES',
    badge: 'AMAZON AI',
    data: [
      { brand: 'Milk Makeup', score: 61 },
      { brand: 'Rhode', score: 52 },
      { brand: 'Glossier', score: 48 },
      { brand: 'Merit Beauty', score: 44 },
      { brand: 'Pat McGrath', score: 42 },
      { brand: 'Tower 28', score: 32 },
      { brand: 'Charlotte Tilbury', score: 28 },
    ],
  },
  {
    title: 'GOOGLE GEMINI — VISIBILITY SCORES',
    badge: null,
    data: [
      { brand: 'Rhode', score: 65 },
      { brand: 'Glossier', score: 62 },
      { brand: 'Milk Makeup', score: 58 },
      { brand: 'Pat McGrath', score: 58 },
      { brand: 'Merit Beauty', score: 52 },
      { brand: 'Tower 28', score: 38 },
      { brand: 'Charlotte Tilbury', score: 35 },
    ],
  },
];

const heatmapData = [
  { brand: 'Milk Makeup', chatgpt: 82, perplexity: 75, rufus: 61, gemini: 58 },
  { brand: 'Rhode', chatgpt: 78, perplexity: 82, rufus: 52, gemini: 65 },
  { brand: 'Glossier', chatgpt: 65, perplexity: 68, rufus: 48, gemini: 62 },
  { brand: 'Pat McGrath', chatgpt: 70, perplexity: 62, rufus: 42, gemini: 58 },
  { brand: 'Merit Beauty', chatgpt: 52, perplexity: 58, rufus: 44, gemini: 52 },
  { brand: 'Tower 28', chatgpt: 45, perplexity: 48, rufus: 32, gemini: 38 },
  { brand: 'Charlotte Tilbury', chatgpt: 42, perplexity: 38, rufus: 28, gemini: 35 },
];

const gapData = [
  { platform: 'ChatGPT', milk: 82, avg: 56, gap: 26 },
  { platform: 'Perplexity', milk: 75, avg: 59, gap: 16 },
  { platform: 'Rufus', milk: 61, avg: 41, gap: 20 },
  { platform: 'Gemini', milk: 58, avg: 52, gap: 6 },
];

const topQueries = [
  { rank: 1, query: 'Best Sephora makeup launches 2026', tag: 'PRODUCT LAUNCH', tagStyle: 'bg-positive/20 text-positive', searches: '180K searches', platforms: '5/5 platforms' },
  { rank: 2, query: 'Best clean concealer 2026', tag: 'CLEAN BEAUTY', tagStyle: 'bg-positive/20 text-positive', searches: '110K searches', platforms: '5/5 platforms' },
  { rank: 3, query: 'Top indie beauty brands right now', tag: 'CATEGORY', tagStyle: 'bg-muted text-muted-foreground', searches: '90K searches', platforms: '4/5 platforms' },
  { rank: 4, query: 'Vegan cruelty-free makeup recommendations', tag: 'CATEGORY', tagStyle: 'bg-muted text-muted-foreground', searches: '74K searches', platforms: '4/5 platforms' },
  { rank: 5, query: 'Amazon clean beauty bestsellers', tag: 'AMAZON / RUFUS-SPECIFIC', tagStyle: 'bg-foreground/10 text-foreground', searches: '62K searches', platforms: '3/5 platforms' },
  { rank: 6, query: 'Affordable clean makeup dupes', tag: 'SHOULD OWN — UNDERPERFORMING', tagStyle: 'bg-corp-news/30 text-foreground', searches: '55K searches', platforms: '2/5 platforms' },
];

const heatmapColor = (val: number) => {
  if (val >= 75) return 'bg-foreground text-background';
  if (val >= 60) return 'bg-foreground/70 text-background';
  if (val >= 45) return 'bg-foreground/40 text-background';
  return 'bg-muted text-muted-foreground';
};

const GeoAISovTab = () => {
  const [view, setView] = useState('BY PLATFORM');

  return (
    <div className="p-6 space-y-6">
      <GeoScorecards />
      <ViewToggle active={view} onToggle={setView} />

      {/* BY PLATFORM view */}
      {view === 'BY PLATFORM' && (
        <div className="grid grid-cols-2 gap-6">
          {platformCharts.map((chart) => (
            <div key={chart.title} className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">{chart.title}</h3>
                {chart.badge && <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-[hsl(30_80%_55%)] text-background">{chart.badge}</span>}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chart.data} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="brand" tick={{ fontSize: 10, fill: 'hsl(0 0% 30%)' }} axisLine={false} tickLine={false} width={95} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} />
                  <Bar
                    dataKey="score"
                    barSize={14}
                    radius={[0, 1, 1, 0]}
                    fill="hsl(0 0% 60%)"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => {
                      const isMilk = props?.payload?.brand === 'Milk Makeup';
                      return <rect {...props} fill={isMilk ? 'hsl(0 0% 9%)' : 'hsl(0 0% 60%)'} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* HEATMAP view */}
      {view === 'HEATMAP' && (
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Visibility Heatmap — All Platforms</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground w-36">Brand</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">ChatGPT</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">Perplexity</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">Rufus</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">Gemini</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row) => (
                  <tr key={row.brand} className={`border-b border-border ${row.brand === 'Milk Makeup' ? 'font-bold' : ''}`}>
                    <td className="py-2 pr-4">{row.brand}</td>
                    <td className="py-1 px-1"><div className={`text-center py-1.5 ${heatmapColor(row.chatgpt)}`}>{row.chatgpt}</div></td>
                    <td className="py-1 px-1"><div className={`text-center py-1.5 ${heatmapColor(row.perplexity)}`}>{row.perplexity}</div></td>
                    <td className="py-1 px-1"><div className={`text-center py-1.5 ${heatmapColor(row.rufus)}`}>{row.rufus}</div></td>
                    <td className="py-1 px-1"><div className={`text-center py-1.5 ${heatmapColor(row.gemini)}`}>{row.gemini}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GAP ANALYSIS view */}
      {view === 'GAP ANALYSIS' && (
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Milk Makeup vs Competitive Average — Gap Analysis</h3>
          <div className="space-y-4">
            {gapData.map((row) => (
              <div key={row.platform} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{row.platform}</span>
                  <span className={`text-[11px] font-bold ${row.gap >= 15 ? 'text-positive' : 'text-muted-foreground'}`}>+{row.gap}pts ahead</span>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 h-5 bg-secondary relative">
                    <div className="h-full bg-foreground/30 absolute" style={{ width: `${row.avg}%` }} />
                    <div className="h-full bg-foreground absolute" style={{ width: `${row.milk}%` }} />
                  </div>
                </div>
                <div className="flex gap-4 text-[10px] text-muted-foreground">
                  <span>Milk Makeup: {row.milk}</span>
                  <span>Competitive avg: {row.avg}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP QUERIES + SOV view */}
      {view === 'TOP QUERIES + SOV' && (
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-1">Top Queries Where Milk Appears</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Ranked by search volume — per-platform visibility scores</p>
          <div className="divide-y divide-border">
            {topQueries.map((q) => (
              <div key={q.rank} className="flex items-center gap-4 py-3">
                <span className="text-sm font-bold w-6 text-right text-muted-foreground">{q.rank}</span>
                <span className="text-sm font-medium flex-1">"{q.query}"</span>
                <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 ${q.tagStyle}`}>{q.tag}</span>
                <span className="text-[11px] text-muted-foreground">{q.searches} · {q.platforms}</span>
                <span className="text-muted-foreground text-xs">▼</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoAISovTab;
