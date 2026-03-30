import { ChevronDown } from 'lucide-react';
import { useWeek } from '@/contexts/WeekContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const DashboardHeader = () => {
  const { selectedWeek, setSelectedWeek, weeks } = useWeek();
  const currentLabel = weeks.find(w => w.weekStart === selectedWeek)?.label ?? 'Loading…';

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 hover:opacity-100 transition-opacity uppercase tracking-widest text-xs">
              Week of {currentLabel}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56 max-h-80 overflow-y-auto bg-card border-border">
            {weeks.map((w) => (
              <DropdownMenuItem
                key={w.weekStart}
                onClick={() => setSelectedWeek(w.weekStart)}
                className={`text-xs tracking-wider cursor-pointer ${
                  w.weekStart === selectedWeek ? 'font-bold text-foreground bg-accent' : 'text-muted-foreground'
                }`}
              >
                {w.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full animate-pulse-live" style={{ backgroundColor: 'hsl(145 63% 42%)' }} />
          <span className="text-xs font-semibold tracking-wider text-positive">LIVE</span>
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
