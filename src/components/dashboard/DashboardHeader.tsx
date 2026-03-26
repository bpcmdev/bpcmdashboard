const DashboardHeader = () => {
  return (
    <header className="dashboard-header px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg font-extrabold tracking-wider uppercase">Milk Makeup</span>
      </div>
      <div className="hidden md:flex items-center gap-3 text-xs tracking-widest uppercase opacity-70">
        <span>Intelligence Dashboard</span>
        <span className="opacity-40">|</span>
        <span>Waldencast PLC · BPCM</span>
        <span className="opacity-40">|</span>
        <span>Week of Mar 17–23, 2026</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse-live" />
          <span className="text-xs font-semibold tracking-wider text-green-400">LIVE</span>
        </div>
        <button className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors">
          Export PDF
        </button>
        <button className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors">
          Refresh
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader;
