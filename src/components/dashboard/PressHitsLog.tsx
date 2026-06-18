import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';
import { useWeek } from '@/contexts/WeekContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdmin } from '@/hooks/useAdmin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, ExternalLink, Plus, AlertCircle, Pencil, Trash2, CalendarIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

function ensureHttps(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

interface Placement {
  id: string;
  headline: string;
  url: string;
  outlet_name: string;
  outlet_tier: number;
  outlet_umv: number | null;
  author_name: string | null;
  published_at: string | null;
  placement_type: string;
  placed_by: string;
  sentiment: string | null;
  ad_value: number | null;
  impressions: number | null;
  tags: string[] | null;
  dismissed: boolean;
}

function formatReach(val: number | null): string {
  if (!val) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tierLabel(tier: number): string {
  return `TIER ${tier}`;
}

const tierBg: Record<number, string> = {
  1: 'bg-tier1',
  2: 'bg-tier2',
  3: 'bg-tier3',
};

function placementLabel(placedBy: string, placementType: string): string {
  if (placementType === 'placed' || (placedBy && placedBy.toLowerCase() !== 'organic')) return 'BPCM Placed';
  return 'Organic';
}

function sentimentColor(s: string | null): string {
  if (s === 'positive') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (s === 'negative') return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const num = (v: string) => (v ? Number(v) : null);

/* ─── Placement Form (shared between Add and Edit) ─── */
interface PlacementFormProps {
  values: {
    headline: string; url: string; outletName: string; outletTier: string;
    outletUmv: string; authorName: string; publishedAt: Date | undefined;
    sentiment: string; placementType: string; adValue: string;
    impressions: string; placedBy: string; tags: string;
  };
  onChange: (field: string, value: any) => void;
}

function PlacementForm({ values, onChange }: PlacementFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="Outlet Name">
          <Input value={values.outletName} onChange={e => onChange('outletName', e.target.value)} className="text-xs" />
        </Field>
        <Field label="Headline">
          <Input value={values.headline} onChange={e => onChange('headline', e.target.value)} className="text-xs" />
        </Field>
      </div>
      <Field label="Article URL">
        <Input value={values.url} onChange={e => onChange('url', e.target.value)} className="text-xs" placeholder="https://..." />
      </Field>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Outlet Tier">
          <Select value={values.outletTier} onValueChange={v => onChange('outletTier', v)}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Outlet UMV">
          <Input type="number" value={values.outletUmv} onChange={e => onChange('outletUmv', e.target.value)} className="text-xs" />
        </Field>
        <Field label="Author Name">
          <Input value={values.authorName} onChange={e => onChange('authorName', e.target.value)} className="text-xs" />
        </Field>
        <Field label="Published Date">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-full justify-start text-left text-xs font-normal", !values.publishedAt && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {values.publishedAt ? format(values.publishedAt, 'MMM d, yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={values.publishedAt} onSelect={d => onChange('publishedAt', d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </Field>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Sentiment">
          <Select value={values.sentiment} onValueChange={v => onChange('sentiment', v)}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Placement Type">
          <Select value={values.placementType} onValueChange={v => onChange('placementType', v)}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="placed">BPCM Placed</SelectItem>
              <SelectItem value="organic">Organic</SelectItem>
              <SelectItem value="newswire">Newswire</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ad Value">
          <Input type="number" value={values.adValue} onChange={e => onChange('adValue', e.target.value)} className="text-xs" />
        </Field>
        <Field label="Impressions">
          <Input type="number" value={values.impressions} onChange={e => onChange('impressions', e.target.value)} className="text-xs" />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="Placed By">
          <Input value={values.placedBy} onChange={e => onChange('placedBy', e.target.value)} className="text-xs" />
        </Field>
        <Field label="Tags (comma separated)">
          <Input value={values.tags} onChange={e => onChange('tags', e.target.value)} className="text-xs" placeholder="tag1, tag2" />
        </Field>
      </div>
    </div>
  );
}

function defaultFormValues() {
  return {
    headline: '', url: '', outletName: '', outletTier: '1',
    outletUmv: '', authorName: '', publishedAt: new Date() as Date | undefined,
    sentiment: 'positive', placementType: 'placed', adValue: '0',
    impressions: '0', placedBy: 'Manual entry', tags: '',
  };
}

function placementToForm(p: Placement) {
  return {
    headline: p.headline || '',
    url: p.url || '',
    outletName: p.outlet_name || '',
    outletTier: String(p.outlet_tier ?? 1),
    outletUmv: p.outlet_umv?.toString() || '',
    authorName: p.author_name || '',
    publishedAt: p.published_at ? new Date(p.published_at + 'T00:00:00') : undefined,
    sentiment: p.sentiment || 'neutral',
    placementType: p.placement_type || 'placed',
    adValue: p.ad_value?.toString() || '0',
    impressions: p.impressions?.toString() || '0',
    placedBy: p.placed_by || '',
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
  };
}

function formToPayload(v: ReturnType<typeof defaultFormValues>) {
  return {
    headline: v.headline.trim(),
    url: v.url.trim() || null,
    outlet_name: v.outletName.trim(),
    outlet_tier: Number(v.outletTier),
    outlet_umv: num(v.outletUmv),
    author_name: v.authorName.trim() || null,
    published_at: v.publishedAt ? format(v.publishedAt, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
    sentiment: v.sentiment,
    placement_type: v.placementType,
    ad_value: num(v.adValue) ?? 0,
    impressions: num(v.impressions) ?? 0,
    placed_by: v.placedBy.trim() || 'Manual entry',
    tags: v.tags ? v.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
  };
}

/* ─── Main Component ─── */
const PressHitsLog = () => {
  const { selectedWeek, refreshKey, activeClientId, effectiveFrom, effectiveTo, rangeMode, isAllTime } = useWeek();
  const { isAdmin } = useAdmin();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<Placement | null>(null);

  // Add form
  const [addForm, setAddForm] = useState(defaultFormValues());
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit
  const [editItem, setEditItem] = useState<Placement | null>(null);
  const [editForm, setEditForm] = useState(defaultFormValues());
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const updateAddForm = (field: string, value: any) => setAddForm(prev => ({ ...prev, [field]: value }));
  const updateEditForm = (field: string, value: any) => setEditForm(prev => ({ ...prev, [field]: value }));

  const fetchPlacements = async () => {
    if (!isAllTime && (!effectiveFrom || !effectiveTo)) return;
    setLoading(true);

    let query = supabase
      .from('placements')
      .select('id, headline, url, outlet_name, outlet_tier, outlet_umv, author_name, published_at, placement_type, placed_by, sentiment, ad_value, impressions, tags, dismissed')
      .order('published_at', { ascending: false });

    if (!isAllTime) {
      query = query.gte('published_at', effectiveFrom).lte('published_at', effectiveTo);
    }

    if (activeClientId) {
      query = query.eq('client_id', activeClientId);
    }

    const { data } = await query;
    setPlacements(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlacements();
  }, [effectiveFrom, effectiveTo, isAllTime, refreshKey, activeClientId, rangeMode]);

  const visible = useMemo(
    () => placements.filter((p) => !p.dismissed),
    [placements]
  );

  const dismissed = useMemo(
    () => placements.filter((p) => p.dismissed),
    [placements]
  );

  const displayList = showDismissed ? [...visible, ...dismissed] : visible;

  const dismiss = async (id: string) => {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, dismissed: true } : p)));
    const { error } = await supabase.from('placements').update({ dismissed: true }).eq('id', id);
    if (error) {
      toast.error('Failed to dismiss placement.');
      setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, dismissed: false } : p)));
    }
  };

  const restore = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, dismissed: false } : p)));
    const { error } = await supabase.from('placements').update({ dismissed: false }).eq('id', id);
    if (error) {
      toast.error('Failed to restore placement.');
      setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, dismissed: true } : p)));
    }
  };

  const handleAdd = async () => {
    if (!addForm.outletName.trim() || !addForm.headline.trim()) {
      toast.error('Outlet name and headline are required.');
      return;
    }
    setSubmitting(true);

    let weekQuery = supabase.from('weekly_snapshots').select('id').eq('week_start', selectedWeek);
    if (activeClientId) weekQuery = weekQuery.eq('client_id', activeClientId);
    const { data: weekRow } = await weekQuery.maybeSingle();

    if (!weekRow) {
      toast.error('No weekly snapshot found for this week.');
      setSubmitting(false);
      return;
    }

    const payload = { ...formToPayload(addForm), client_id: activeClientId, week_id: weekRow.id };
    const { data: inserted, error } = await supabase.from('placements').insert(payload).select('id').single();

    if (error) {
      toast.error('Failed to add placement.');
      console.error(error);
    } else {
      logActivity({ client_id: activeClientId, action: 'created', entity_type: 'placement', entity_id: inserted?.id, entity_title: payload.headline, metadata: { outlet_name: payload.outlet_name } });
      toast.success('Hit added successfully.');
      setAddForm(defaultFormValues());
      setShowAddForm(false);
      await fetchPlacements();
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!editItem) return;
    setEditSubmitting(true);
    const payload = formToPayload(editForm);
    const { error } = await supabase.from('placements').update(payload).eq('id', editItem.id);
    if (error) {
      toast.error('Failed to update placement.');
      console.error(error);
    } else {
      logActivity({ client_id: activeClientId, action: 'updated', entity_type: 'placement', entity_id: editItem.id, entity_title: payload.headline, metadata: { outlet_name: payload.outlet_name } });
      toast.success('Placement updated.');
      setEditItem(null);
      await fetchPlacements();
    }
    setEditSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const target = placements.find(p => p.id === deleteId);
    const { error } = await supabase.from('placements').delete().eq('id', deleteId);
    if (error) {
      toast.error('Failed to delete placement.');
    } else {
      logActivity({ client_id: activeClientId, action: 'deleted', entity_type: 'placement', entity_id: deleteId, entity_title: target?.headline ?? 'Placement' });
      toast.success('Placement deleted.');
      setDeleteId(null);
      await fetchPlacements();
    }
  };

  const openEdit = (p: Placement, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm(placementToForm(p));
    setEditItem(p);
  };

  const openDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  return (
    <>
      <div className="bg-card p-4 md:p-5 border border-border space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
            All Press Hits — Running Log
          </h3>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Switch id="show-dismissed" checked={showDismissed} onCheckedChange={setShowDismissed} className="scale-75" />
                <Label htmlFor="show-dismissed" className="text-[10px] text-muted-foreground cursor-pointer">Show dismissed</Label>
              </div>
            )}
            {!loading && (
              <span className="text-xs font-semibold text-foreground">
                {visible.length} hit{visible.length !== 1 ? 's' : ''}
              </span>
            )}
            {isAdmin && (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="w-3.5 h-3.5" />
                ADD HIT
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No placements for this week.</p>
        ) : (
          <div className="space-y-1.5">
            {displayList.map((p) => {
              const sentimentBorder =
                p.sentiment === 'positive'
                  ? '!border-l-[hsl(218_60%_47%)]'
                  : p.sentiment === 'negative'
                  ? '!border-l-[hsl(0_70%_61%)]'
                  : '!border-l-white/20';
              return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 md:gap-3 py-2.5 pl-3 pr-2 group cursor-pointer rounded-sm bg-card border-l-[3px] border-transparent transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04] hover:!border-l-[hsl(var(--chart-gold))]",
                  sentimentBorder,
                  p.dismissed && "opacity-40"
                )}
                onClick={() => setPreviewItem(p)}
              >
                <span className="text-[13px] font-bold w-28 md:w-36 shrink-0 truncate text-foreground">{p.outlet_name}</span>
                <span className="text-xs text-primary flex-1 text-left truncate">{p.headline}</span>
                <span className="text-[11px] text-muted-foreground shrink-0 hidden md:inline">
                  {p.published_at ? formatDate(p.published_at) : ''}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0 w-12 text-right">
                  {formatReach(p.outlet_umv)}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline w-24 text-center">
                  {placementLabel(p.placed_by, p.placement_type)}
                </span>
                <span className={`shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 ${tierBg[p.outlet_tier] ?? 'bg-tier1'}`}>
                  {tierLabel(p.outlet_tier)}
                </span>
                {isAdmin && !p.dismissed && (
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => openEdit(p, e)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => openDelete(p.id, e)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); dismiss(p.id); }} className="p-1 rounded text-muted-foreground hover:text-foreground" title="Dismiss">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {isAdmin && p.dismissed && (
                  <button
                    onClick={(e) => restore(p.id, e)}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                    title="Restore"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* Add form — admin only */}
        {isAdmin && showAddForm && (
          <div className="border-t border-border pt-4 space-y-3">
            <PlacementForm values={addForm} onChange={updateAddForm} />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground max-w-lg">
                Paste any article URL missed by the API — it will appear at the top of the log and open in the article preview.
              </p>
              <Button size="sm" onClick={handleAdd} disabled={submitting} className="text-xs gap-1">
                <Plus className="w-3.5 h-3.5" />
                {submitting ? 'Adding…' : 'ADD HIT'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview panel */}
      <Sheet open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {previewItem && (
            <SheetHeader className="space-y-4">
              <SheetTitle className="text-base leading-snug">{previewItem.headline}</SheetTitle>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">{previewItem.outlet_name}</p>
                {previewItem.published_at && (
                  <p className="text-muted-foreground">{formatDate(previewItem.published_at)}</p>
                )}
                <p className="text-muted-foreground">Reach: {formatReach(previewItem.outlet_umv)}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 ${tierBg[previewItem.outlet_tier] ?? 'bg-tier1'}`}>
                    {tierLabel(previewItem.outlet_tier)}
                  </span>
                  {previewItem.sentiment && (
                    <Badge variant="outline" className={cn('text-[10px] capitalize', sentimentColor(previewItem.sentiment))}>
                      {previewItem.sentiment}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {placementLabel(previewItem.placed_by, previewItem.placement_type)}
                  </span>
                </div>
              </div>
              {previewItem.url && (() => {
                const safeUrl = ensureHttps(previewItem.url);
                return (
                  <div className="space-y-3 pt-2">
                    <div className="border border-border rounded overflow-hidden relative">
                      <iframe
                        src={safeUrl}
                        title="Article preview"
                        className="w-full h-[50vh]"
                        sandbox="allow-scripts allow-same-origin"
                        onError={(e) => {
                          (e.target as HTMLIFrameElement).style.display = 'none';
                          const fallback = (e.target as HTMLIFrameElement).nextElementSibling;
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                      <div className="hidden flex-col items-center justify-center gap-2 py-10 text-center">
                        <AlertCircle className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">This article cannot be previewed — click Open in New Tab to read it.</p>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs">
                      <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in New Tab
                      </a>
                    </Button>
                  </div>
                );
              })()}
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold tracking-widest uppercase">Edit Placement</DialogTitle>
          </DialogHeader>
          <PlacementForm values={editForm} onChange={updateEditForm} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editSubmitting || !editForm.headline.trim()}>
              {editSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Placement</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this placement. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PressHitsLog;
