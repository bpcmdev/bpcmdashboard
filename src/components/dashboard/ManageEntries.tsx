import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { logActivity, ActivityEntityType } from '@/lib/activityLog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarIcon, Pencil, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABLE_TO_ENTITY: Record<string, ActivityEntityType> = {
  key_wins: 'key_win',
  pipeline_moments: 'pipeline_moment',
  partnerships: 'partnership',
  product_pipeline: 'product_launch',
};

const PAGE_SIZE = 20;

type TabKey = 'keywins' | 'pipeline' | 'partnerships' | 'products';

interface TabConfig {
  label: string;
  table: string;
  titleField: string;
  dateField: string;
  fields: { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'date'; options?: string[] }[];
}

const TAB_CONFIGS: Record<TabKey, TabConfig> = {
  keywins: {
    label: 'Key Wins',
    table: 'key_wins',
    titleField: 'title',
    dateField: 'created_at',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['Corporate Comms', 'Earned Media', 'Influencer & Social', 'Brand Partnership'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'reach', label: 'Reach', type: 'text' },
      { key: 'tier', label: 'Tier', type: 'select', options: ['Tier 1', 'Tier 2', 'Organic'] },
    ],
  },
  pipeline: {
    label: 'Pipeline Moments',
    table: 'pipeline_moments',
    titleField: 'title',
    dateField: 'created_at',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'event_date', label: 'Event Date', type: 'date' },
      { key: 'event_type', label: 'Event Type', type: 'select', options: ['launch', 'event', 'corp-comms', 'milestone', 'moment', 'retail'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['active', 'watch', 'upcoming'] },
    ],
  },
  partnerships: {
    label: 'Partnerships',
    table: 'partnerships',
    titleField: 'partner_name',
    dateField: 'created_at',
    fields: [
      { key: 'partner_name', label: 'Partner Name', type: 'text' },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['live', 'in-development', 'past'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'emv_generated', label: 'EMV Generated', type: 'number' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'end_date', label: 'End Date', type: 'date' },
    ],
  },
  products: {
    label: 'Product Launches',
    table: 'product_pipeline',
    titleField: 'product_name',
    dateField: 'created_at',
    fields: [
      { key: 'product_name', label: 'Product Name', type: 'text' },
      { key: 'launch_type', label: 'Launch Type', type: 'select', options: ['new-launch', 'hero-launch', 'reformulated', 'entry-product', 'upcoming'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'launch_date', label: 'Launch Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'upcoming', 'in-planning'] },
    ],
  },
};

function DateFilter({ date, onSelect, label }: { date: Date | undefined; onSelect: (d: Date | undefined) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 text-[11px] justify-start", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {date ? format(date, 'MM/dd/yy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

interface ManageEntriesProps {
  clientId: string | null;
}

export default function ManageEntries({ clientId }: ManageEntriesProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('keywins');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const config = TAB_CONFIGS[activeTab];
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchEntries = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    let query = supabase
      .from(config.table)
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.ilike(config.titleField, `%${search.trim()}%`);
    }
    if (dateFrom) {
      query = query.gte('created_at', format(dateFrom, 'yyyy-MM-dd'));
    }
    if (dateTo) {
      query = query.lte('created_at', format(dateTo, 'yyyy-MM-dd') + 'T23:59:59');
    }

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) console.error(`[ManageEntries] fetch ${config.table} error:`, error);
    setEntries(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [clientId, config.table, config.titleField, search, dateFrom, dateTo, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Reset page/search on tab change
  useEffect(() => {
    setSearch('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  }, [activeTab]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    const formData: Record<string, any> = {};
    config.fields.forEach(f => {
      formData[f.key] = entry[f.key] ?? '';
    });
    setEditForm(formData);
  };

  const handleSave = async () => {
    if (!editEntry) return;
    setSaving(true);
    const payload: Record<string, any> = {};
    config.fields.forEach(f => {
      const val = editForm[f.key];
      if (f.type === 'number') {
        payload[f.key] = val !== '' && val != null ? Number(val) : null;
      } else if (f.type === 'date') {
        payload[f.key] = val instanceof Date ? format(val, 'yyyy-MM-dd') : (val || null);
      } else {
        payload[f.key] = val || null;
      }
    });

    const { error } = await supabase.from(config.table).update(payload).eq('id', editEntry.id);
    if (error) console.error(`[ManageEntries] update ${config.table} error:`, error);
    setSaving(false);
    if (!error) {
      const entityType = TABLE_TO_ENTITY[config.table];
      if (entityType) {
        logActivity({ client_id: clientId, action: 'updated', entity_type: entityType, entity_id: editEntry.id, entity_title: String(editForm[config.titleField] ?? '') });
      }
      setEditEntry(null);
      fetchEntries();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const target = entries.find(e => e.id === deleteId);
    const { error } = await supabase.from(config.table).delete().eq('id', deleteId);
    if (error) console.error(`[ManageEntries] delete ${config.table} error:`, error);
    setDeleteId(null);
    if (!error) {
      const entityType = TABLE_TO_ENTITY[config.table];
      if (entityType) {
        logActivity({ client_id: clientId, action: 'deleted', entity_type: entityType, entity_id: deleteId, entity_title: target ? String(target[config.titleField] ?? '') : '' });
      }
      fetchEntries();
    }
  };

  const renderFieldInput = (field: typeof config.fields[0]) => {
    const val = editForm[field.key];
    if (field.type === 'select' && field.options) {
      return (
        <Select value={val || ''} onValueChange={v => setEditForm(prev => ({ ...prev, [field.key]: v }))}>
          <SelectTrigger className="text-xs"><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            {field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (field.type === 'textarea') {
      return <Textarea value={val || ''} onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="text-xs" />;
    }
    if (field.type === 'date') {
      const dateVal = val ? (val instanceof Date ? val : new Date(val)) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-full justify-start text-left text-xs", !dateVal && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3 w-3" />
              {dateVal && !isNaN(dateVal.getTime()) ? format(dateVal, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateVal} onSelect={d => setEditForm(prev => ({ ...prev, [field.key]: d }))} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      );
    }
    return (
      <Input
        type={field.type === 'number' ? 'number' : 'text'}
        value={val || ''}
        onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
        className="text-xs"
      />
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Manage Entries</p>

      {/* Tab bar */}
      <div className="flex gap-1 border border-border rounded-lg p-1 bg-muted/30">
        {(Object.keys(TAB_CONFIGS) as TabKey[]).map(key => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 text-[10px] font-semibold tracking-wider uppercase py-1.5 rounded-md transition-colors",
              activeTab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {TAB_CONFIGS[key].label}
          </button>
        ))}
      </div>

      {/* Search + Date filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search by ${config.titleField.replace('_', ' ')}…`}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-2">
          <DateFilter date={dateFrom} onSelect={setDateFrom} label="From" />
          <DateFilter date={dateTo} onSelect={setDateTo} label="To" />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Entry list */}
      <div className="space-y-1">
        {loading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No entries found.</p>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 group hover:bg-muted/20 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{entry[config.titleField]}</p>
                <p className="text-[10px] text-muted-foreground">
                  {entry.created_at ? format(new Date(entry.created_at), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div className="flex items-center gap-0.5 ml-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(entry.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-[10px] text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Edit drawer */}
      <Sheet open={!!editEntry} onOpenChange={open => { if (!open) setEditEntry(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">Edit {config.label.replace(/s$/, '')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {config.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">{field.label}</label>
                {renderFieldInput(field)}
              </div>
            ))}
            <Button onClick={handleSave} disabled={saving} className="w-full bg-foreground text-background hover:bg-foreground/90">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
