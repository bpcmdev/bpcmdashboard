import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'Tier 1', value: 19, color: 'hsl(0 0% 9%)' },
  { name: 'Tier 2', value: 17, color: 'hsl(0 0% 35%)' },
  { name: 'Tier 3', value: 11, color: 'hsl(0 0% 70%)' },
];

const CoverageByTier = () => {
  return (
    <div>
      <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">
        Coverage by Outlet Tier
      </h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0 0% 9%)',
                border: 'none',
                borderRadius: '2px',
                color: 'white',
                fontSize: 11,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: item.color }} />
              <span className="text-xs">{item.name}</span>
              <span className="text-xs font-bold ml-1">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CoverageByTier;
