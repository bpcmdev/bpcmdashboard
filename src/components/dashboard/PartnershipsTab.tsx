import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';

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
  const { clientId } = useAdmin();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('partnerships')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) console.error('[PartnershipsTab] error:', error);
      setPartnerships(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [clientId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (partnerships.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground py-24">
        No partnerships yet. Add entries via the Admin panel.
      </div>
    );
  }

  const active = partnerships.filter(p => p.status !== 'past');
  const past = partnerships.filter(p => p.status === 'past');
  const emvData = partnerships
    .filter(p => p.emv_generated && p.emv_generated > 0)
    .map(p => ({ program: p.partner_name, emv: p.emv_generated! }))
    .sort((a, b) => b.emv - a.emv);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Active & Pipeline */}
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Active & Pipeline Partnerships</h3>
          <div className="space-y-4">
            {active.map((p) => {
              const badge = statusBadge[p.status] ?? { label: p.status.toUpperCase(), style: 'bg-muted text-muted-foreground' };
              return (
                <div key={p.id} className="border border-border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-bold">{p.partner_name}</h4>
                      <p className="text-[11px] text-muted-foreground">{p.type}</p>
                    </div>
                    <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 shrink-0 ${badge.style}`}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              );
            })}
            {active.length === 0 && <p className="text-xs text-muted-foreground">No active partnerships</p>}
          </div>
        </div>

        {/* EMV Chart */}
        {emvData.length > 0 && (
          <div className="bg-card border border-border p-5">
            <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-4">Partnership EMV</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={emvData} layout="vertical" margin={{ left: 100, right: 30 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}K`} />
                <YAxis type="category" dataKey="program" tick={{ fontSize: 11, fill: 'hsl(0 0% 20%)' }} axisLine={false} tickLine={false} width={95} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(0 0% 9%)', border: 'none', borderRadius: '2px', color: 'white', fontSize: 11 }} formatter={(v: number) => `$${v}K`} />
                <Bar dataKey="emv" fill="hsl(0 0% 9%)" barSize={18} radius={[0, 1, 1, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Historical */}
      {past.length > 0 && (
        <div className="bg-card border border-border p-5">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-3">Historical Reference</h3>
          <div className="divide-y divide-border">
            {past.map((h) => (
              <div key={h.id} className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{h.partner_name}</p>
                  <p className="text-[11px] text-muted-foreground">{h.description}</p>
                  {h.emv_generated && <p className="text-[10px] text-muted-foreground mt-0.5">${h.emv_generated}K EMV generated</p>}
                </div>
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-muted text-muted-foreground shrink-0">PAST</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnershipsTab;
