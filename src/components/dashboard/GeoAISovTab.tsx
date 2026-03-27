import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { PlatformScorecards, ViewToggle } from './AIVisibilityTab';

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

const GeoAISovTab = () => {
  const [view, setView] = useState('BY PLATFORM');

  return (
    <div className="p-6 space-y-6">
      <PlatformScorecards />
      <ViewToggle active={view} onToggle={setView} />

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
    </div>
  );
};

export default GeoAISovTab;
