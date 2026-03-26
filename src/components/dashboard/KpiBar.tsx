interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'neutral';
}

const KpiCard = ({ label, value, delta, deltaType }: KpiCardProps) => {
  const deltaColor = deltaType === 'positive' ? 'text-positive' : deltaType === 'negative' ? 'text-negative' : 'text-neutral-delta';
  return (
    <div className="flex-1 px-5 py-4 text-center">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className={`text-[11px] mt-0.5 ${deltaColor}`}>{delta}</p>
    </div>
  );
};

const kpis: KpiCardProps[] = [
  { label: 'Press Placements', value: '47', delta: '▲ 31% vs prior week', deltaType: 'positive' },
  { label: 'Earned Media Value', value: '$2.1M', delta: '▲ 18%', deltaType: 'positive' },
  { label: 'Sentiment Score', value: '72/100', delta: '▲ 8pts MoM', deltaType: 'positive' },
  { label: 'Social Reach', value: '6.4M', delta: '▲ 22%', deltaType: 'positive' },
  { label: 'Share of Voice', value: '21%', delta: '▲ 4pts', deltaType: 'positive' },
  { label: 'Influencer ROI', value: '4.2x', delta: '— stable', deltaType: 'neutral' },
];

const KpiBar = () => {
  return (
    <div className="bg-card flex divide-x divide-border border-b border-border">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};

export default KpiBar;
