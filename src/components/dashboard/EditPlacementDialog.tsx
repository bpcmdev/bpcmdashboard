import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, CalendarIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWeek } from '@/contexts/WeekContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PlacementEntry {
  id: string;
  headline: string;
  url: string;
  outlet_name: string;
  outlet_tier: number;
  outlet_umv: number | null;
  author_name: string;
  published_at: string | null;
  sentiment: string;
  ad_value: number | null;
  impressions: number | null;
  placement_type: string;
  placed_by: string;
  tags: string[];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function EditPlacementDialog({ entry }: { entry: PlacementEntry }) {
  const { refreshData } = useWeek();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [headline, setHeadline] = useState(entry.headline || '');
  const [url, setUrl] = useState(entry.url || '');
  const [outletName, setOutletName] = useState(entry.outlet_name || '');
  const [outletTier, setOutletTier] = useState(String(entry.outlet_tier ?? 1));
  const [outletUmv, setOutletUmv] = useState(entry.outlet_umv?.toString() || '');
  const [authorName, setAuthorName] = useState(entry.author_name || '');
  const [publishedAt, setPublishedAt] = useState<Date | undefined>(entry.published_at ? new Date(entry.published_at + 'T00:00:00') : undefined);
  const [sentiment, setSentiment] = useState(entry.sentiment || '');
  const [adValue, setAdValue] = useState(entry.ad_value?.toString() || '');
  const [impressions, setImpressions] = useState(entry.impressions?.toString() || '');
  const [placementType, setPlacementType] = useState(entry.placement_type || '');
  const [placedBy, setPlacedBy] = useState(entry.placed_by || '');
  const [tags, setTags] = useState(Array.isArray(entry.tags) ? entry.tags.join(', ') : '');

  const resetForm = () => {
    setHeadline(entry.headline || '');
    setUrl(entry.url || '');
    setOutletName(entry.outlet_name || '');
    setOutletTier(String(entry.outlet_tier ?? 1));
    setOutletUmv(entry.outlet_umv?.toString() || '');
    setAuthorName(entry.author_name || '');
    setPublishedAt(entry.published_at ? new Date(entry.published_at + 'T00:00:00') : undefined);
    setSentiment(entry.sentiment || '');
    setAdValue(entry.ad_value?.toString() || '');
    setImpressions(entry.impressions?.toString() || '');
    setPlacementType(entry.placement_type || '');
    setPlacedBy(entry.placed_by || '');
    setTags(Array.isArray(entry.tags) ? entry.tags.join(', ') : '');
    setConfirming(false);
  };

  const num = (v: string) => v ? Number(v) : null;

  const handleSave = async () => {
    setSubmitting(true);
    const payload = {
      headline,
      url,
      outlet_name: outletName,
      outlet_tier: Number(outletTier),
      outlet_umv: num(outletUmv),
      author_name: authorName,
      published_at: publishedAt ? format(publishedAt, 'yyyy-MM-dd') : null,
      sentiment,
      ad_value: num(adValue),
      impressions: num(impressions),
      placement_type: placementType,
      placed_by: placedBy,
      tags: tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    console.log('[EditPlacement] update payload:', payload);
    const { error } = await supabase.from('placements').update(payload).eq('id', entry.id);
    if (error) console.error('[EditPlacement] update error:', error);
    setSubmitting(false);
    if (!error) {
      setOpen(false);
      setConfirming(false);
      refreshData();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold tracking-widest uppercase">Edit Placement</DialogTitle>
        </DialogHeader>
        {confirming ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Are you sure you want to save these changes?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting}>{submitting ? 'Saving…' : 'Confirm'}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <Field label="Headline"><Input value={headline} onChange={e => setHeadline(e.target.value)} /></Field>
            <Field label="URL"><Input value={url} onChange={e => setUrl(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Outlet Name"><Input value={outletName} onChange={e => setOutletName(e.target.value)} /></Field>
              <Field label="Outlet Tier">
                <Select value={outletTier} onValueChange={setOutletTier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1</SelectItem>
                    <SelectItem value="2">Tier 2</SelectItem>
                    <SelectItem value="3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Outlet UMV"><Input type="number" value={outletUmv} onChange={e => setOutletUmv(e.target.value)} /></Field>
              <Field label="Author Name"><Input value={authorName} onChange={e => setAuthorName(e.target.value)} /></Field>
            </div>
            <Field label="Published Date">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !publishedAt && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {publishedAt ? format(publishedAt, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={publishedAt} onSelect={setPublishedAt} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sentiment">
                <Select value={sentiment} onValueChange={setSentiment}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Placement Type">
                <Select value={placementType} onValueChange={setPlacementType}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earned">Earned</SelectItem>
                    <SelectItem value="newswire">Newswire</SelectItem>
                    <SelectItem value="contributed">Contributed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ad Value"><Input type="number" value={adValue} onChange={e => setAdValue(e.target.value)} /></Field>
              <Field label="Impressions"><Input type="number" value={impressions} onChange={e => setImpressions(e.target.value)} /></Field>
            </div>
            <Field label="Placed By"><Input value={placedBy} onChange={e => setPlacedBy(e.target.value)} /></Field>
            <Field label="Tags (comma separated)"><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="Comma separated" /></Field>
            <Button onClick={() => setConfirming(true)} disabled={!headline} className="w-full bg-foreground text-background hover:bg-foreground/90">Save Changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
