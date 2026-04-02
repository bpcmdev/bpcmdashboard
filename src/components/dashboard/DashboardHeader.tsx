import { useState } from 'react';
import { ChevronDown, LogOut, Shield, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWeek } from '@/contexts/WeekContext';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import AdminPanel from '@/components/dashboard/AdminPanel';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DashboardHeader = () => {
  const { selectedWeek, setSelectedWeek, weeks, lastUpdated, refreshData } = useWeek();
  const { isAdmin, clientId, clientName, clientLogo, clientColor, allClients, switchClient } = useAdmin();
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentLabel = weeks.find(w => w.weekStart === selectedWeek)?.label ?? 'Loading…';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const handleClientSwitch = (newClientId: string) => {
    switchClient(newClientId);
    // Trigger data refresh after switch
    setTimeout(() => refreshData(), 100);
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  };

  return (
    <header className="dashboard-header px-4 md:px-6 py-3">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {clientLogo && (
            <img src={clientLogo} alt={clientName ?? ''} className="h-6 w-auto" />
          )}
          <span className="text-base md:text-lg font-extrabold tracking-wider uppercase">
            {clientName ?? 'Loading…'}
          </span>
        </div>

        {/* Desktop center info */}
        <div className="hidden md:flex items-center gap-3 text-xs tracking-widest uppercase opacity-70">
          <span>Intelligence Dashboard</span>
          <span className="opacity-40">|</span>
          {isAdmin && allClients.length > 1 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 hover:opacity-100 transition-opacity uppercase tracking-widest text-xs font-semibold border border-white/20 px-2 py-1 rounded">
                    Switch Client
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 max-h-80 overflow-y-auto bg-card border-border">
                  {allClients.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => handleClientSwitch(c.id)}
                      className={`text-xs tracking-wider cursor-pointer ${
                        c.id === clientId ? 'font-bold text-foreground bg-accent' : 'text-muted-foreground'
                      }`}
                    >
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="opacity-40">|</span>
            </>
          )}
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

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full animate-pulse-live" style={{ backgroundColor: 'hsl(145 63% 42%)' }} />
              <span className="text-xs font-semibold tracking-wider text-positive">LIVE</span>
            </div>
            {lastUpdated && (
              <span className="text-[9px] text-muted-foreground tracking-wide">
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </div>
          <button className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors">
            Export PDF
          </button>
          <button onClick={refreshData} className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors">
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
            >
              <Shield className="w-3 h-3" />
              Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        {isMobile && (
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Mobile expanded menu */}
      {isMobile && mobileMenuOpen && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {/* Week selector */}
          <div className="text-[10px] tracking-widest uppercase text-white/60 mb-1">Week</div>
          <Select value={selectedWeek} onValueChange={(v) => { setSelectedWeek(v); }}>
            <SelectTrigger className="w-full text-xs bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((w) => (
                <SelectItem key={w.weekStart} value={w.weekStart} className="text-xs">
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Admin client switcher */}
          {isAdmin && allClients.length > 1 && (
            <>
              <div className="text-[10px] tracking-widest uppercase text-white/60 mb-1">Client</div>
              <Select value={clientId ?? ''} onValueChange={handleClientSwitch}>
                <SelectTrigger className="w-full text-xs bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {allClients.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={refreshData} className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors">
              Refresh
            </button>
            <button className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors">
              Export PDF
            </button>
            {isAdmin && (
              <button
                onClick={() => { setAdminOpen(true); setMobileMenuOpen(false); }}
                className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
              >
                <Shield className="w-3 h-3" />
                Admin
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full animate-pulse-live" style={{ backgroundColor: 'hsl(145 63% 42%)' }} />
            <span className="text-xs font-semibold tracking-wider text-positive">LIVE</span>
            {lastUpdated && (
              <span className="text-[9px] text-muted-foreground tracking-wide ml-2">
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </div>
        </div>
      )}

      {isAdmin && <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} clientId={clientId} />}
    </header>
  );
};

export default DashboardHeader;
