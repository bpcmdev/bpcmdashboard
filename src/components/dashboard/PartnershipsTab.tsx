import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import DeleteEntryButton from './DeleteEntryButton';
import EditPartnershipDialog from './EditPartnershipDialog';
import EmptyState from './EmptyState';
import { formatMoney } from '@/lib/format';

const PAGE_SIZE = 10;
const formatEmv = formatMoney;

interface Partnership {
  id: string;
  partner_name: string;
  type: string;
  status: string;
  description: string;
  emv_generated: number | null;
  notes: string;
}

const statusBadge: Record<string, { label: string; style: string }> = {
  live: { label: 'LIVE', style: 'bg-[hsl(145_63%_42%)] text-background' },
  'in-development': { label: 'IN DEVELOPMENT', style: 'bg-corp-news' },
  past: { label: 'PAST', style: 'bg-muted text-muted-foreground' },
};

const PartnershipsTab = () => {
  const { refreshKey, activeClientId: clientId, isAllTime, effectiveFrom, effectiveTo } = useWeek();
  const { isAdmin } = useAdmin();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);

  useEffect(() => {
    if (!clientId) return;
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    const fetch = async () => {
      setLoading(true);
      setError(false);
      let q = supabase
        .from('partnerships')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (!isAllTime) {
        // Include partnerships whose [start_date, end_date] window overlaps the selected window.
        // Treat null start/end dates as open-ended (always overlap on that side).
        q = q
          .or(`start_date.is.null,start_date.lte.${effectiveTo}`)
          .or(`end_date.is.null,end_date.gte.${effectiveFrom}`);
      }
      const { data, error: err } = await q;
      if (err) {
        console.error('[PartnershipsTab] error:', err);
        setError(true);
      }
      setPartnerships(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId, refreshKey, isAllTime, effectiveFrom, effectiveTo]);

  const active = partnerships.filter(p => p.status !== 'past');
  const past = partnerships.filter(p => p.status === 'past');
  const activeTotalPages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const pastTotalPages = Math.max(1, Math.ceil(past.length / PAGE_SIZE));
  const activePaginated = active.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const pastPaginated = past.slice((pastPage - 1) * PAGE_SIZE, pastPage * PAGE_SIZE);
  const { clientColor } = useAdmin();
  const accent = clientColor || '#1B2B8A';
  const emvData = useMemo(() => partnerships
    .filter(p => p.emv_generated && p.emv_generated > 0)
    .map(p => ({ program: p.partner_name, emv: p.emv_generated! }))
    .sort((a, b) => b.emv - a.emv)
    .slice(0, 10), [partnerships]);

  return (
    <DataStateWrapper loading={loading} error={error}>
      {partnerships.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon="🤝"
            title="No partnerships yet"
            description="Add entries via the Admin panel or upload a weekly document."
          />
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-black/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="section-label">Active &amp; Pipeline Partnerships</span>
                <span className="section-count">{active.length}</span>
              </div>
              <div className="space-y-4">
                {activePaginated.map((p) => {
                  const badge = statusBadge[p.status] ?? { label: p.status.toUpperCase(), style: 'bg-muted text-muted-foreground' };
                  const initials = p.partner_name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={p.id} className="entry-card cat-partnership bg-card border border-black/10 p-4 cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 flex items-center justify-center text-[11px] font-bold text-white shrink-0 rounded-sm"
                          style={{ background: 'linear-gradient(135deg, hsl(225 70% 35%) 0%, #047857 100%)' }}
                        >
                          {initials || '—'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate">{p.partner_name}</h4>
                              <p className="text-[11px] text-muted-foreground">{p.type}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-mono-ui text-[9px] font-medium tracking-[0.12em] uppercase px-1.5 py-0.5 ${badge.style}`}>{badge.label}</span>
                              {isAdmin && <EditPartnershipDialog entry={p} />}
                              {isAdmin && <DeleteEntryButton table="partnerships" id={p.id} label="this partnership" />}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                          {p.emv_generated ? (
                            <div className="flex items-baseline gap-1.5 mt-2">
                              <span className="font-mono-ui text-[8px] tracking-[0.18em] uppercase text-muted-foreground">EMV</span>
                              <span className="font-display text-base font-bold" style={{ color: 'hsl(42 64% 38%)' }}>{formatMoney(p.emv_generated)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {active.length === 0 && <p className="text-xs text-muted-foreground">No active partnerships</p>}
              </div>
              {activeTotalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <button
                    onClick={() => setActivePage(p => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(0,0,0,0.1)', background: 'none', color: activePage === 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)', cursor: activePage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)' }}>
                    {activePage} / {activeTotalPages}
                  </span>
                  <button
                    onClick={() => setActivePage(p => Math.min(activeTotalPages, p + 1))}
                    disabled={activePage === activeTotalPages}
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(0,0,0,0.1)', background: 'none', color: activePage === activeTotalPages ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)', cursor: activePage === activeTotalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {emvData.length > 0 && (
              <div className="p-5">
                <h3 className="section-label mb-4">Top 10 Campaigns by EMV</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={emvData} margin={{ top: 24, right: 16, left: 8, bottom: 80 }}>
                    <CartesianGrid stroke="rgba(0,0,0,0.08)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="program"
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 10, fill: 'hsl(0 0% 30%)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => (v && v.length > 20 ? `${v.slice(0, 20)}…` : v)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatEmv}
                      width={56}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', color: 'hsl(0 0% 8%)', fontSize: 11 }}
                      formatter={(v: number) => formatEmv(v)}
                    />
                    <Bar dataKey="emv" fill="#1B2B8A" fillOpacity={1} maxBarSize={48} radius={[2, 2, 0, 0]}>
                      <LabelList
                        dataKey="emv"
                        position="top"
                        formatter={(v: number) => formatEmv(v)}
                        style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'hsl(0 0% 25%)', fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div className="bg-card border border-border p-5">
              <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Historical Reference</h3>
              <div className="divide-y divide-border">
                {pastPaginated.map((h) => (
                  <div key={h.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{h.partner_name}</p>
                      <p className="text-[11px] text-muted-foreground">{h.description}</p>
                      {h.emv_generated && <p className="text-[10px] text-muted-foreground mt-0.5">${h.emv_generated}K EMV generated</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-muted text-muted-foreground">PAST</span>
                      {isAdmin && <EditPartnershipDialog entry={h} />}
                      {isAdmin && <DeleteEntryButton table="partnerships" id={h.id} label="this partnership" />}
                    </div>
                  </div>
                ))}
              </div>
              {pastTotalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <button
                    onClick={() => setPastPage(p => Math.max(1, p - 1))}
                    disabled={pastPage === 1}
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(0,0,0,0.1)', background: 'none', color: pastPage === 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)', cursor: pastPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)' }}>
                    {pastPage} / {pastTotalPages}
                  </span>
                  <button
                    onClick={() => setPastPage(p => Math.min(pastTotalPages, p + 1))}
                    disabled={pastPage === pastTotalPages}
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(0,0,0,0.1)', background: 'none', color: pastPage === pastTotalPages ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.6)', cursor: pastPage === pastTotalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </DataStateWrapper>
  );
};

export default PartnershipsTab;
