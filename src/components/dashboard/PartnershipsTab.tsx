import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LabelList, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { useWeek } from '@/contexts/WeekContext';
import DataStateWrapper from './DataStateWrapper';
import DeleteEntryButton from './DeleteEntryButton';
import EditPartnershipDialog from './EditPartnershipDialog';
import EmptyState from './EmptyState';
import PartnershipAccordion from './PartnershipAccordion';
import { formatMoney, formatCount } from '@/lib/format';

const PAGE_SIZE = 10;
const formatEmv = formatMoney;

// Same keyword extraction used inside PartnershipAccordion — keep in sync.
const coreKeyword = (name: string) => {
  const core = name
    .replace(/\b(all|event|events|campaign|campaigns|seeding|rollup|influencer|influencers)\b/gi, '')
    .replace(/[-–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return core.length >= 4 ? core.toLowerCase() : name.trim().toLowerCase();
};

// Round up to a "nice" max for evenly-spaced y-axis ticks (multiples of 1/2/2.5/5 × 10^n).
const niceCeil = (n: number) => {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const frac = n / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
};

interface CampaignStat {
  id: string;
  program: string;
  emv: number;
  posts: number;
  influencers: number;
  reach: number;
}


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
  const { isAdmin, clientColor } = useAdmin();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [postsForStats, setPostsForStats] = useState<Array<{ author_name: string | null; reach: number | null; emv: number | null; campaign_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [openSignals, setOpenSignals] = useState<Record<string, number>>({});

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

      // Posts for chart aggregation (post count / influencer count / reach per campaign).
      let pq = supabase
        .from('lefty_posts')
        .select('author_name, reach, emv, campaign_name, posted_at')
        .eq('client_id', clientId)
        .limit(5000);
      if (!isAllTime && effectiveFrom && effectiveTo) {
        pq = pq.gte('posted_at', effectiveFrom).lte('posted_at', `${effectiveTo}T23:59:59.999Z`);
      }
      const { data: posts } = await pq;
      setPostsForStats(posts ?? []);

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
  const accent = clientColor || '#1B2B8A';
  const gradientId = useMemo(() => `emvBar-${Math.random().toString(36).slice(2, 8)}`, []);

  const emvData: CampaignStat[] = useMemo(() => {
    const top = partnerships
      .filter(p => p.emv_generated && p.emv_generated > 0)
      .sort((a, b) => (b.emv_generated ?? 0) - (a.emv_generated ?? 0))
      .slice(0, 10);
    return top.map(p => {
      const kw = coreKeyword(p.partner_name);
      const matched = postsForStats.filter(post =>
        typeof post.campaign_name === 'string' && post.campaign_name.toLowerCase().includes(kw)
      );
      const influencers = new Set(matched.map(m => (m.author_name ?? '').trim()).filter(Boolean));
      const reach = matched.reduce((s, m) => s + (m.reach ?? 0), 0);
      return {
        id: p.id,
        program: p.partner_name,
        emv: p.emv_generated ?? 0,
        posts: matched.length,
        influencers: influencers.size,
        reach,
      };
    });
  }, [partnerships, postsForStats]);

  const yMax = useMemo(() => niceCeil(Math.max(0, ...emvData.map(d => d.emv))), [emvData]);
  const yTicks = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map(f => yMax * f), [yMax]);
  const labelThreshold = yMax * 0.12;

  const handleBarClick = (data: CampaignStat | undefined | null) => {
    // Recharts sometimes wraps the entry; normalize.
    const payload = (data && 'payload' in (data as object)
      ? (data as unknown as { payload: CampaignStat }).payload
      : (data as CampaignStat | null | undefined));
    // eslint-disable-next-line no-console
    console.log('[PartnershipsTab] bar click →', payload?.program, payload?.id);
    if (!payload?.id) return;
    const idx = active.findIndex(p => p.id === payload.id);
    if (idx >= 0) {
      const page = Math.floor(idx / PAGE_SIZE) + 1;
      setActivePage(page);
    }
    setOpenSignals(prev => ({ ...prev, [payload.id]: (prev[payload.id] ?? 0) + 1 }));
  };

  // Right-aligned y-axis tick (campaign name) for horizontal bar chart — clickable
  const renderYTick = (props: { x: number; y: number; payload: { value: string; index?: number } }) => {
    const { x, y, payload } = props;
    const entry = emvData.find(d => d.program === payload.value);
    return (
      <text
        x={x - 8}
        y={y}
        textAnchor="end"
        dominantBaseline="middle"
        fontSize={11}
        fill="hsl(0 0% 20%)"
        style={{ cursor: entry ? 'pointer' : 'default' }}
        onClick={() => entry && handleBarClick(entry)}
      >
        {payload.value}
      </text>
    );
  };



  // Custom tooltip
  const renderTooltip = ({ active: a, payload }: { active?: boolean; payload?: Array<{ payload: CampaignStat }> }) => {
    if (!a || !payload || !payload[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-black/10 px-3 py-2 text-[11px] shadow-sm" style={{ minWidth: 180 }}>
        <p className="font-semibold text-foreground mb-1.5">{d.program}</p>
        <div className="space-y-0.5 text-muted-foreground">
          <div className="flex justify-between gap-4"><span>EMV</span><span className="tabular-nums font-semibold text-foreground">{formatEmv(d.emv)}</span></div>
          <div className="flex justify-between gap-4"><span>Posts</span><span className="tabular-nums">{d.posts}</span></div>
          <div className="flex justify-between gap-4"><span>Influencers</span><span className="tabular-nums">{d.influencers}</span></div>
          <div className="flex justify-between gap-4"><span>Reach</span><span className="tabular-nums">{formatCount(d.reach)}</span></div>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 pt-1.5 border-t border-black/[0.06]">Click to expand partnership</p>
      </div>
    );
  };


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
              <div className="space-y-3">
                {activePaginated.map((p) => {
                  const badge = statusBadge[p.status] ?? { label: p.status.toUpperCase(), style: 'bg-muted text-muted-foreground' };
                  return (
                    <PartnershipAccordion
                      key={p.id}
                      partnership={p}
                      statusBadge={badge}
                      accent={accent}
                      isAdmin={isAdmin}
                      variant="card"
                      openSignal={openSignals[p.id]}
                    />

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

            {emvData.length > 0 && (() => {
              const rowHeight = 40;
              const chartHeight = Math.max(220, emvData.length * rowHeight + 60);
              const yAxisWidth = Math.min(
                220,
                Math.max(120, ...emvData.map(d => d.program.length * 6.5 + 16))
              );
              return (
                <div className="p-5">
                  <h3 className="section-label mb-4">Top 10 Campaigns by EMV</h3>
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                      data={emvData}
                      layout="vertical"
                      margin={{ top: 8, right: 64, left: 8, bottom: 24 }}
                      barCategoryGap="30%"
                      onMouseLeave={() => setHoverIdx(null)}
                    >
                      <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={accent} stopOpacity={1} />
                          <stop offset="100%" stopColor={accent} stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(0,0,0,0.08)" strokeDasharray="2 4" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, yMax]}
                        ticks={yTicks}
                        tick={{ fontSize: 10, fill: 'hsl(0 0% 40%)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatEmv}
                      />
                      <YAxis
                        type="category"
                        dataKey="program"
                        interval={0}
                        width={yAxisWidth}
                        axisLine={false}
                        tickLine={false}
                        tick={renderYTick as unknown as ReactElement}
                      />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={renderTooltip as unknown as ReactElement} />
                      <Bar
                        dataKey="emv"
                        radius={[0, 2, 2, 0]}
                        fill={`url(#${gradientId})`}
                        isAnimationActive={false}
                        onClick={(d) => handleBarClick(d as unknown as CampaignStat)}
                        style={{ cursor: 'pointer' }}
                      >
                        {emvData.map((entry, i) => {
                          const dim = hoverIdx !== null && hoverIdx !== i;
                          return (
                            <Cell
                              key={entry.id}
                              fill={`url(#${gradientId})`}
                              stroke={accent}
                              strokeOpacity={0}
                              fillOpacity={dim ? 0.5 : 1}
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setHoverIdx(i)}
                              onClick={() => handleBarClick(entry)}
                            />
                          );
                        })}
                        <LabelList
                          dataKey="emv"
                          content={(props: { x?: number; y?: number; width?: number; height?: number; value?: number; index?: number }) => {
                            const { x = 0, y = 0, width = 0, height = 0, value = 0, index = 0 } = props;
                            const dim = hoverIdx !== null && hoverIdx !== index;
                            const entry = emvData[index];
                            return (
                              <text
                                x={x + width + 8}
                                y={y + height / 2}
                                textAnchor="start"
                                dominantBaseline="middle"
                                fontSize={11}
                                fontFamily="DM Mono, monospace"
                                fontWeight={600}
                                fill="hsl(0 0% 20%)"
                                opacity={dim ? 0.4 : 1}
                                style={{ cursor: 'pointer' }}
                                onClick={() => entry && handleBarClick(entry)}
                              >
                                {formatEmv(value)}
                              </text>
                            );
                          }}
                        />
                      </Bar>

                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}


          </div>

          {past.length > 0 && (
            <div className="bg-card border border-border p-5">
              <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Historical Reference</h3>
              <div className="divide-y divide-border">
                {pastPaginated.map((h) => (
                  <PartnershipAccordion
                    key={h.id}
                    partnership={h}
                    statusBadge={{ label: 'PAST', style: 'bg-muted text-muted-foreground' }}
                    accent={accent}
                    isAdmin={isAdmin}
                    variant="row"
                  />
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
