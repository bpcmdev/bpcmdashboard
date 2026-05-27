import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { LayoutDashboard, Users, FileText, Database, Building2, LogOut, Plus, ExternalLink, Activity, ToggleLeft, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { WeekProvider } from '@/contexts/WeekContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ALL_TABS } from '@/lib/dashboardTabs';
import {
  PipelineForm,
  KeyWinsForm,
  PartnershipsForm,
  ProductLaunchesForm,
  PlacementsForm,
  WeeklySnapshotForm,
  UserManagement,
  NarrativeWatchForm,
  TabAccessManager,
} from '@/components/dashboard/AdminPanel';
import ManageEntries from '@/components/dashboard/ManageEntries';
import ActivityLogSection from '@/components/admin/ActivityLogSection';

type SectionKey = 'overview' | 'clients' | 'users' | 'narrative' | 'data' | 'activity' | 'tab_access';

const NAV: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { key: 'clients', label: 'Clients', icon: Building2 },
  { key: 'tab_access', label: 'Tab Access', icon: ToggleLeft },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'narrative', label: 'Narrative Watch', icon: FileText },
  { key: 'data', label: 'Data Entry', icon: Database },
  { key: 'activity', label: 'Activity Log', icon: Activity },
];

const SIDEBAR_BG = '#0a1628';

interface ClientRow {
  id: string;
  name: string;
  slug: string | null;
  primary_color: string | null;
  logo_url: string | null;
  enabled_tabs: string[] | null;
  created_at: string;
}

const CASCADE_TABLES = [
  'user_profiles',
  'client_credentials',
  'lefty_posts',
  'partnerships',
  'weekly_snapshots',
] as const;

/* ── Clients Section ── */
function ClientsSection() {
  const navigate = useNavigate();
  const { switchClient } = useAdmin();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', primary_color: '#0a1628', logo_url: '' });

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('id, name, slug, primary_color, logo_url, created_at')
      .order('created_at', { ascending: false });
    setClients((data as ClientRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, slug: slugify(name) }));
  };

  const handleOpenDashboard = (client: ClientRow) => {
    switchClient(client.id);
    setTimeout(() => navigate('/dashboard'), 50);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('https://primary-production-20bbd.up.railway.app/webhook/onboard-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          primary_color: form.primary_color,
          logo_url: form.logo_url,
        }),
      });
      if (!res.ok) throw new Error(`Webhook failed (${res.status})`);
      setSuccess('Client onboarded — dashboard ready.');
      setForm({ name: '', slug: '', primary_color: '#0a1628', logo_url: '' });
      setTimeout(() => { setOpen(false); setSuccess(''); fetchClients(); }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setError(msg);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all client tenants</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
              <Plus className="w-4 h-4" /> Add New Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Onboard New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Name</Label>
                <Input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Acme Beauty" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Slug</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="acme-beauty" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Logo URL</Label>
                <Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://…" />
              </div>
              {success && <p className="text-xs text-positive font-medium">{success}</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.name || !form.slug} className="bg-foreground text-background hover:bg-foreground/90">
                {submitting ? 'Onboarding…' : 'Onboard Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading clients…</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <div key={c.id} className="border border-border rounded-lg p-5 space-y-4 bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold tracking-tight truncate">{c.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{c.slug || '—'}</p>
                </div>
                <div
                  className="w-8 h-8 rounded border border-border shrink-0"
                  style={{ backgroundColor: c.primary_color || '#e5e5e5' }}
                  title={c.primary_color || ''}
                />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Created {format(new Date(c.created_at), 'PP')}
              </p>
              <Button
                variant="outline"
                className="w-full gap-2 text-xs uppercase tracking-wider"
                onClick={() => handleOpenDashboard(c)}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Dashboard
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Overview Section ── */
interface OverviewRow {
  client_id: string;
  client_name: string;
  week_start: string | null;
  placement_count: number | null;
  emv_usd: number | null;
  sentiment_score: number | null;
}

function OverviewSection() {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      const list = (clients as { id: string; name: string }[]) || [];

      const results = await Promise.all(
        list.map(async (c) => {
          const { data } = await supabase
            .from('weekly_snapshots')
            .select('week_start, placement_count, emv_usd, sentiment_score')
            .eq('client_id', c.id)
            .order('week_start', { ascending: false })
            .limit(1)
            .maybeSingle();
          return {
            client_id: c.id,
            client_name: c.name,
            week_start: data?.week_start ?? null,
            placement_count: data?.placement_count ?? null,
            emv_usd: data?.emv_usd ?? null,
            sentiment_score: data?.sentiment_score ?? null,
          } as OverviewRow;
        })
      );
      setRows(results);
      setLoading(false);
    };
    load();
  }, []);

  const fmtNum = (n: number | null) => n == null ? '—' : new Intl.NumberFormat('en-US').format(n);
  const fmtCurrency = (n: number | null) => n == null ? '—' : `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;
  const fmtSentiment = (n: number | null) => n == null ? '—' : n.toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Latest weekly snapshot for every client</p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Client</th>
                <th className="text-left px-4 py-3 font-semibold">Latest Week</th>
                <th className="text-right px-4 py-3 font-semibold">Placements</th>
                <th className="text-right px-4 py-3 font-semibold">EMV</th>
                <th className="text-right px-4 py-3 font-semibold">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.client_id} className={i > 0 ? 'border-t border-border' : ''}>
                  <td className="px-4 py-3 font-semibold">{r.client_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.week_start ? format(new Date(r.week_start + 'T00:00:00'), 'PP') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNum(r.placement_count)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(r.emv_usd)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtSentiment(r.sentiment_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Data Entry Section ── */
function DataEntrySection() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [section, setSection] = useState<string>('pipeline');

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      const list = (data as { id: string; name: string }[]) || [];
      setClients(list);
      if (list.length && !selectedClient) setSelectedClient(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientId = selectedClient || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Entry</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage entries for any client without switching dashboards</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border rounded-lg p-4 bg-card">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Section</Label>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="keywins">Key Wins</SelectItem>
              <SelectItem value="partnerships">Partnerships</SelectItem>
              <SelectItem value="products">Products</SelectItem>
              <SelectItem value="placements">Placements</SelectItem>
              <SelectItem value="snapshot">Weekly Snapshot</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card">
        {!clientId ? (
          <p className="text-sm text-muted-foreground">Select a client to begin.</p>
        ) : (
          <>
            {section === 'pipeline' && <PipelineForm clientId={clientId} />}
            {section === 'keywins' && <KeyWinsForm clientId={clientId} />}
            {section === 'partnerships' && <PartnershipsForm clientId={clientId} />}
            {section === 'products' && <ProductLaunchesForm clientId={clientId} />}
            {section === 'placements' && <PlacementsForm clientId={clientId} />}
            {section === 'snapshot' && <WeeklySnapshotForm clientId={clientId} />}
          </>
        )}
      </div>

      {clientId && (
        <div className="border-t border-border pt-6">
          <ManageEntries clientId={clientId} />
        </div>
      )}
    </div>
  );
}

/* ── Main Layout ── */
function SuperAdminContent() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [section, setSection] = useState<SectionKey>('clients');

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate('/dashboard', { replace: true });
  }, [adminLoading, isAdmin, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const content = useMemo(() => {
    switch (section) {
      case 'overview': return <OverviewSection />;
      case 'clients': return <ClientsSection />;
      case 'users': return <UserManagement />;
      case 'narrative': return <NarrativeWatchForm defaultClientId={null} />;
      case 'data': return <DataEntrySection />;
      case 'activity': return <ActivityLogSection />;
      case 'tab_access': return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tab Access</h1>
            <p className="text-sm text-muted-foreground mt-1">Toggle which dashboard tabs are visible per client</p>
          </div>
          <TabAccessManager />
        </div>
      );
    }
  }, [section]);

  if (adminLoading) return <div className="min-h-screen bg-background" />;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col text-white"
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <h1 className="text-2xl font-bold tracking-[0.2em]">BPCM</h1>
          <p className="text-[10px] tracking-[0.22em] uppercase mt-1 text-white/60">Super Admin</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-semibold tracking-wider uppercase transition-colors ${
                  active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-semibold tracking-wider uppercase text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>Back to Dashboard</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-semibold tracking-wider uppercase text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 md:py-10">
          {content}
        </div>
      </main>
    </div>
  );
}

const SuperAdmin = () => {
  const { loading } = useAuth(true);
  if (loading) return <div className="min-h-screen bg-background" />;
  return (
    <WeekProvider>
      <SuperAdminContent />
    </WeekProvider>
  );
};

export default SuperAdmin;
