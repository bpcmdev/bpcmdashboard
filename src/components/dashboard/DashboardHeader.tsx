import { useEffect, useState } from 'react';
import { ChevronDown, LogOut, Shield, ShieldCheck, Menu, X, Search, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWeek } from '@/contexts/WeekContext';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import AdminPanel from '@/components/dashboard/AdminPanel';
import ExplainMonthDrawer from '@/components/dashboard/ExplainMonthDrawer';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DashboardHeader = () => {
  const { selectedWeek, setSelectedWeek, weeks, lastUpdated, refreshData, setOverrideClientId, rangeMode, rangeFrom, rangeTo, isAllTime: weekIsAllTime } = useWeek();

  const openPrintReport = () => {
    if (!clientId) return;
    let range = 'all-time';
    if (rangeMode === 'range' && rangeFrom && rangeTo) {
      range = `${rangeFrom}:${rangeTo}`;
    } else if (!weekIsAllTime && selectedWeek) {
      range = selectedWeek;
    }
    window.open(`/report/${clientId}?range=${encodeURIComponent(range)}&autoprint=1`, '_blank');
  };
  const { isAdmin, clientId, clientName, clientLogo, clientColor, allClients, switchClient } = useAdmin();
  const [adminOpen, setAdminOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const filteredClients = allClients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Allow other parts of the app (e.g. Getting Started checklist) to open the admin panel.
  useEffect(() => {
    const handler = () => setAdminOpen(true);
    window.addEventListener('bpcm:open-admin-panel', handler);
    return () => window.removeEventListener('bpcm:open-admin-panel', handler);
  }, []);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isAllTime = selectedWeek === 'all-time';
  const currentLabel = isAllTime
    ? 'All Time'
    : (weeks.find(w => w.weekStart === selectedWeek)?.label ?? 'Loading…');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const handleClientSwitch = (newClientId: string) => {
    switchClient(newClientId);
    setOverrideClientId(newClientId);
    setClientSearch('');
    setTimeout(() => refreshData(), 100);
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  };

  return (
    <header
      className="dashboard-header px-4 md:px-6 py-2 border-b sticky top-0 z-40"
      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {clientLogo && (
            <img src={clientLogo} alt={clientName ?? ''} className="h-6 w-auto" />
          )}
          <span className="font-display text-sm md:text-base font-bold tracking-[0.06em] uppercase text-white truncate">
            {clientName ?? 'Loading…'}
          </span>
        </div>

        {/* Desktop center info */}
        <div className="hidden md:flex items-center gap-2 text-[11px] tracking-widest uppercase opacity-80">
          {isAdmin && allClients.length > 1 && (
            <>
              <DropdownMenu onOpenChange={(open) => { if (!open) setClientSearch(''); }}>
                <DropdownMenuTrigger asChild>
                  <button className="header-chip">
                    Switch Client
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-64 max-h-96 overflow-hidden bg-card border-border p-0"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-2 py-2">
                    <Search className="w-3 h-3 opacity-60" />
                    <input
                      autoFocus
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Search clients…"
                      className="flex-1 bg-transparent text-xs tracking-wider outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground tracking-wider">No clients found</div>
                    ) : (
                      filteredClients.map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          onClick={() => handleClientSwitch(c.id)}
                          className={`text-xs tracking-wider cursor-pointer ${
                            c.id === clientId ? 'font-bold text-foreground bg-accent' : 'text-muted-foreground'
                          }`}
                        >
                          {c.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="opacity-40">|</span>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="header-chip">
                {isAllTime ? currentLabel : `Week of ${currentLabel}`}
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
          <button
            className="header-chip"
            onClick={() => window.dispatchEvent(new CustomEvent('bpcm:export-pdf'))}
          >
            Export PDF
          </button>
          <button onClick={refreshData} className="header-chip">
            Refresh
          </button>
          {isAdmin && (
            <button onClick={() => setExplainOpen(true)} className="header-chip">
              <Sparkles className="w-3 h-3 opacity-80" />
              Explain This Month
            </button>
          )}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="header-chip">
                  <Shield className="w-3 h-3" />
                  Admin
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={() => setAdminOpen(true)} className="text-xs tracking-wider cursor-pointer">
                  <Shield className="w-3 h-3 mr-1.5" />
                  Admin Panel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin')} className="text-xs tracking-wider cursor-pointer">
                  <ShieldCheck className="w-3 h-3 mr-1.5" />
                  Super Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-xs tracking-wider cursor-pointer">
                  <LogOut className="w-3 h-3 mr-1.5" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isAdmin && (
            <button onClick={handleLogout} className="header-chip">
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          )}
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
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('bpcm:export-pdf')); setMobileMenuOpen(false); }}
              className="text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
            >
              Export PDF
            </button>
            {isAdmin && (
              <button
                onClick={() => { setExplainOpen(true); setMobileMenuOpen(false); }}
                className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
              >
                <Sparkles className="w-3 h-3 opacity-80" />
                Explain This Month
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setAdminOpen(true); setMobileMenuOpen(false); }}
                className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
              >
                <Shield className="w-3 h-3" />
                Admin Panel
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}
                className="flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase px-3 py-1.5 border border-white/20 hover:bg-white/10 transition-colors"
              >
                <ShieldCheck className="w-3 h-3" />
                Super Admin
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
      {isAdmin && (
        <ExplainMonthDrawer
          open={explainOpen}
          onOpenChange={setExplainOpen}
          clientId={clientId}
          clientName={clientName}
          month={(() => {
            const base = !isAllTime && selectedWeek ? new Date(selectedWeek + 'T00:00:00') : new Date();
            const y = base.getFullYear();
            const m = String(base.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}-01`;
          })()}
        />
      )}
    </header>
  );
};

export default DashboardHeader;
