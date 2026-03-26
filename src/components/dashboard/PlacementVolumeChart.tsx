import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { week: 'Jan 26', placements: 18 },
  { week: 'Feb 2', placements: 22 },
  { week: 'Feb 9', placements: 20 },
  { week: 'Feb 16', placements: 25 },
  { week: 'Feb 23', placements: 28 },
  { week: 'Mar 2', placements: 30 },
  { week: 'Mar 9', placements: 35 },
  { week: 'Mar 16', placements: 40 },
  { week: 'Mar 23', placements: 47 },
];

const PlacementVolumeChart = () => {
  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Placement Volume — 8 Weeks
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
            axisLine={{ stroke: 'hsl(0 0% 90%)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 50]}
            tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0 0% 9%)',
              border: 'none',
              borderRadius: '2px',
              color: 'white',
              fontSize: 11,
            }}
          />
          <Bar dataKey="placements" fill="hsl(0 0% 9%)" radius={[1, 1, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PlacementVolumeChart;
