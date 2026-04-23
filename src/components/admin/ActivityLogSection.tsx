import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Pencil, Plus, Trash2, Mail, Check, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityRow {
  id: string;
  client_id: string | null;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_title: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  clients: { name: string } | null;
}

const ENTITY_TYPES = [
  'key_win', 'placement', 'pipeline_moment', 'partnership',
  'product_launch', 'user', 'weekly_snapshot', 'narrative_watch',
];

function actionIcon(action: string) {
  switch (action) {
    case 'created': return <Plus className="w-3.5 h-3.5 text-positive" />;
    case 'updated': return <Pencil className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'deleted': return <Trash2 className="w-3.5 h-3.5 text-destructive" />;
    case 'invited': return <Mail className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'approved': return <Check className="w-3.5 h-3.5 text-positive" />;
    default: return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function prettyEntity(t: string) {
  return t.replace(/_/g, ' ');
}

export default function ActivityLogSection() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      setClients((data as { id: string; name: string }[]) || []);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) console.error('[ActivityLog] fetch error:', error);
    setRows((data as unknown as ActivityRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (clientFilter !== 'all' && r.client_id !== clientFilter) return false;
      if (entityFilter !== 'all' && r.entity_type !== entityFilter) return false;
      if (dateFrom && new Date(r.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > end) return false;
      }
      return true;
    });
  }, [rows, clientFilter, entityFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setClientFilter('all'); setEntityFilter('all');
    setDateFrom(undefined); setDateTo(undefined);
  };
  const hasFilters = clientFilter !== 'all' || entityFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Latest 100 admin actions across all clients</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-border rounded-lg p-4 bg-card">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Client</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Entity Type</Label>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ENTITY_TYPES.map(e => <SelectItem key={e} value={e} className="capitalize">{prettyEntity(e)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-full justify-start text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-3 w-3" />
                {dateFrom ? format(dateFrom, 'PP') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-full justify-start text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-3 w-3" />
                {dateTo ? format(dateTo, 'PP') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        {hasFilters && (
          <div className="md:col-span-4">
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>Clear filters</Button>
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="border border-border rounded-lg bg-card">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">No activity found.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 shrink-0">{actionIcon(r.action)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{r.user_name || 'Unknown'}</span>
                    <span className="text-muted-foreground"> {r.action} </span>
                    <span className="text-muted-foreground capitalize">{prettyEntity(r.entity_type)}</span>
                    {r.entity_title && (
                      <>
                        <span className="text-muted-foreground"> — </span>
                        <span className="font-medium">{r.entity_title}</span>
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {r.clients?.name && (
                      <Badge variant="outline" className="text-[10px] font-normal">{r.clients.name}</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
